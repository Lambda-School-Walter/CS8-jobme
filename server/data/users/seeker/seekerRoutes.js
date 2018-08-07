/* eslint prefer-const: 0 */
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const secret = process.env.SECRET_KEY;
const Seeker = require('./seekerModel');
const Job = require('../../jobs/jobModel');
const Employer = require('../employer/employerModel');

const EXPIRATION = 1000 * 60 * 60 * 12; /* hours in milliseconds */
const router = express.Router();

router
  .get('/', passport.authenticate('bearer', { session: false }),
    (req, res) => {
      if (req.user.userType !== 'employer') {
        return res.status(401).json({ message: 'You must be logged in as an employer to browse job seekers.' });
      }
      const employerId = req.user.id;
      Employer
        .findById(employerId).populate('submittedJobs')
        .then((employer) => {
          const seekerQueries = employer.submittedJobs.map((job) => {
            const { topSkills, skippedSeekers, likedSeekers } = job;
            return Seeker.find({
              topSkills: { $in: topSkills },
              _id: { $not: { $in: [...skippedSeekers, ...likedSeekers] } },
            }).select('-password -likedJobs -matchedJobs -skippedJobs -email')
              .then(seekers => ({
                job,
                seekers,
              }));
          });
          Promise.all(seekerQueries)
            .then((jobs) => {
              const jobsWithSeekers = jobs.filter(job => job.seekers.length);
              const jobWithSeekers = jobsWithSeekers[Math.floor(Math.random() * jobsWithSeekers.length)];
              res.status(200).json(jobWithSeekers);
            }).catch((err) => {
              res.status(500).json({ message: err.message });
            });
        }).catch(err => res.status(500).json({ message: err.message }));
    })
  .post('/register', (req, res) => {
    const {
      email,
      firstName,
      lastName,
      desiredTitle,
      summary,
      topSkills,
      additionalSkills,
      familiarWith,
      password,
      experience,
      education,
    } = req.body;

    if (!experience || !education || !email || !firstName
      || !lastName || !summary || !topSkills || !password || !email) {
      return res.status(300).json({ message: 'The following fields are required: experience, education, email, firstName, lastName, summary, topSkills, password, email.' });
    }

    const seeker = new Seeker({
      email,
      firstName,
      lastName,
      desiredTitle,
      summary,
      topSkills,
      additionalSkills,
      familiarWith,
      password,
      experience,
      education,
    });

    seeker
      .save()
      .then((profile) => {
        const payload = {
          exp: Date.now() + EXPIRATION,
          sub: seeker._id,
          userType: seeker.userType,
        };
        const token = jwt.sign(payload, secret);
        return res.status(200).json({ profile, token });
      })
      .catch((err) => {
        res.status(500).json({ message: err.message });
      });
  })
  .post('/login', (req, res) => {
    const { email, password } = req.body;
    Seeker.findOne({ email })
      // check if password matches
      .then((seeker) => {
        if (!seeker) {
          return res.status(400).json({ message: 'Seeker record not found.' });
        }
        seeker
          .validify(password)
          .then((passwordIsValid) => {
            if (!passwordIsValid) {
              return res.status(401).json({ message: 'Bad credentials.' });
            }
            const payload = {
              exp: Date.now() + EXPIRATION,
              sub: seeker._id,
              userType: seeker.userType,
            };
            const token = jwt.sign(payload, secret);
            const profile = seeker;
            return res.json({ profile, token });
          })
          .catch(err => res.status(500).json(err));
      })
      .catch(err => res.status(500).json(err));
  })
  .put('/like/:seekerId', passport.authenticate('bearer'), (req, res) => {
    // read data from jwt, params, and body
    const employer = req.user;
    const { userType } = req.user;
    const { seekerId } = req.params;
    const { jobId, superLike, skip } = req.body;
    // check userType before unnecessarily hitting db
    if (userType !== 'employer') {
      return res.status(400).json({ message: 'Must be logged in as employer to call a job seeker.' });
    }
    if (employer.credits < 10 && employer.callsAvailable < 1) {
      return res.status(400).json({ message: 'You do not have enough credits to call a job seeker.' });
    }
    // find seeker and grab liked and matched jobs
    Seeker
      .findById(seekerId)
      .then((seeker) => {
        // find job and grab liked and matched seekers
        Job
          .findById(jobId)
          .then((job) => {
            // grab appropriate fields from employer and job documents
            const { matchedJobs, likedJobs } = seeker;
            let { callsAvailable, credits, previousMatches } = employer;
            const { matchedSeekers, likedSeekers, skippedSeekers } = job;
            const match = superLike || (likedJobs.indexOf(jobId) !== -1);
            // if no skip, check for existing like. like and charge if like is new.
            if (skip && skippedSeekers.indexOf(seekerId === -1)) {
              skippedSeekers.push(seekerId);
            } else if (likedSeekers.indexOf(seeker._id) === -1) {
              likedSeekers.push(seeker._id);
              if (match && matchedSeekers.indexOf(seeker._id === -1)) {
                matchedSeekers.push(seeker._id);
                previousMatches.push(seeker._id);
                matchedJobs.push(job._id);
              }
              // charge for service
              if (callsAvailable > 0) {
                callsAvailable -= 1;
              } else {
                credits -= 10;
              }
            }
            // update job, seeker, and employer with new information
            job
              .save()
              .then(() => {
                seeker
                  .update({ matchedJobs })
                  .then(() => {
                    employer
                      .update({ callsAvailable, credits, previousMatches })
                      .then(() => {
                        // return changes to job and match boolean to trigger newMatch event
                        res.status(200).json({
                          callsAvailable, credits, match,
                        });
                      }).catch(err => res.status(500).json({ at: 'Employer update', message: err.message }));
                  }).catch(err => res.status(500).json({ at: 'Seeker update', message: err.message }));
              }).catch(err => res.status(500).json({ at: 'Job update', message: err.message }));
          }).catch(err => res.status(500).json({ at: 'Find job', message: err.message }));
      }).catch(err => res.status(500).json({ at: 'Find seeker', message: err.message }));
  })
  .put('/archive/:seekerId', passport.authenticate('bearer'), (req, res) => {
    // read data from jwt, params, and body
    const employer = req.user;
    const { userType } = req.user;
    const { seekerId } = req.params;
    const { jobId } = req.body;
    // check userType before unnecessarily hitting db
    if (userType !== 'employer') {
      return res.status(400).json({ message: 'Must be logged in as employer to call a job seeker.' });
    }
    Seeker
      .findById(seekerId)
      .then((seeker) => {
        // find job and grab matched seekers
        Job
          .findById(jobId)
          .then((job) => {
            // grab appropriate fields from employer and job documents
            let { matchedSeekers } = job;
            matchedSeekers = matchedSeekers.filter(match => match.toString() !== seekerId);
            job
              .save()
              .then(() => {
                res.status(200).json({ matchedSeekers });
              }).catch(err => res.status(500).json({ at: 'Job update', message: err.message }));
          }).catch(err => res.status(500).json({ at: 'Find job', message: err.message }));
      }).catch(err => res.status(500).json({ at: 'Find seeker', message: err.message }));
  })
  .get('/profile', passport.authenticate('bearer', { session: false }),
    (req, res) => {
      res.status(200).json(req.user);
    })
  .put('/profile', passport.authenticate('bearer', { session: false }), (req, res) => {
    const oldUser = req.user; // model that passport returns
    const buffer = Object.keys(req.body);
    const restricted = ['userType', 'matchedJobs', 'password'];
    const changes = {};
    buffer.forEach((key) => { // will check for null and restricted values
      if (!restricted.includes(key)) {
        if (req.body[key]) {
          changes[key] = req.body[key];
        }
      }
    });
    Seeker.findOneAndUpdate({ email: oldUser.email }, changes).then(() => {
      res.status(200).json(changes);
    }).catch(err => res.status(500).json({ message: err.message }));
  })
  .put('/password', passport.authenticate('bearer', { session: false }), (req, res) => {
    const oldSeeker = req.user;
    const { oldPassword } = req.body;
    Seeker.findById(oldSeeker._id)
      .then((seeker) => {
        seeker.validify(oldPassword).then((isValid) => {
          if (!isValid) {
            res.status(403).json({ message: 'Old password invalid' });
          }
          oldSeeker.password = req.body.newPassword;
          oldSeeker.save()
            .then((user) => {
              res.status(200).json(user);
            }).catch((err) => {
              res.status(500).json({ message: err.message });
            });
        })
          .catch(() => {
            res.status(500).json({ message: 'Failed to validate password. It\'s not your fault.' });
          });
      })
      .catch((err) => {
        res.status(500).json({ err });
      });
  });

module.exports = router;
