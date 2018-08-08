/* eslint consistent-return: 0 */
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const secret = process.env.SECRET_KEY;
const Employer = require('./employerModel');

const EXPIRATION = 1000 * 60 * 60 * 12; /* hours in milliseconds */
const router = express.Router();

router
  .post('/register', (req, res) => {
    const {
      companyName, companyUrl, industry, description, email, password,
    } = req.body;

    if (!companyName || !companyUrl || !industry || !description || !email || !password) {
      return res.status(300).json({ message: "You need to think about what you're sending, bro." });
    }

    const employer = new Employer({
      companyName,
      companyUrl,
      industry,
      description,
      password,
      email,
    });

    employer
      .save()
      .then((profile) => {
        const payload = {
          exp: Date.now() + EXPIRATION,
          sub: employer._id,
          userType: employer.userType,
        };
        const token = jwt.sign(payload, secret);
        res.status(200).json({ profile, token });
      })
      .catch((err) => {
        res.status(500).json({ message: err.message });
      });
  })
  .post('/login', (req, res) => {
    const { email, password } = req.body;
    Employer.findOne({ email })
      // check if password matches
      .then((employer) => {
        if (!employer) {
          return res.status(404).json({ message: 'Employer not found.' });
        }
        employer
          .validify(password)
          .then((passwordIsValid) => {
            if (!passwordIsValid) {
              return res.status(401).json({ message: 'Bad credentials.' });
            }
            const payload = {
              exp: Date.now() + EXPIRATION,
              sub: employer._id,
              userType: employer.userType,
            };
            const token = jwt.sign(payload, secret);
            const profile = employer;
            res.json({ profile, token });
          })
          .catch((err) => {
            res.status(500).json({ message: err.message });
          });
      })
      .catch(err => res.status(500).json(err));
  })
  .get('/profile', passport.authenticate('bearer', { session: false }),
    (req, res) => {
      res.status(200).json(req.user);
    })
  .put('/profile', passport.authenticate('bearer', { session: false }), (req, res) => {
    const oldUser = req.user; // model that passport returns
    const buffer = Object.keys(req.body);
    const restricted = ['userType', 'submittedJobs'];
    const newUser = {};
    buffer.forEach((key) => { // will check for null and restricted values
      if (!restricted.includes(key)) {
        if (req.body[key]) {
          newUser[key] = req.body[key];
        }
      }
    });
    Employer.findOneAndUpdate({ email: oldUser.email }, newUser).then((user) => {
      res.status(200).json(user);
    }).catch(err => res.status(500).json(err));
  })
  .put('/password', passport.authenticate('bearer', { session: false }), (req, res) => {
    const oldEmployer = req.user;
    const { oldPassword } = req.body;
    Employer.findById(oldEmployer._id)
      .then((employer) => {
        employer.validify(oldPassword).then((isValid) => {
          if (!isValid) {
            res.status(403).json({ message: 'Old password invalid' });
          }
          oldEmployer.password = req.body.newPassword;
          oldEmployer.save()
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
