// node modules
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const passport = require('passport');
const morgan = require('morgan');

// local files
const employerRouter = require('./data/users/employer/employerRoutes');
const seekerRouter = require('./data/users/seeker/seekerRoutes');
const billingRouter = require('./data/billing/routes/billingRoutes');
// const Employer = require('./server/users/employer/employerModel');

const server = express();

const originUrl = process.env.NODE_ENV === 'production'
? 'https:jobitduder.herokuapp.com' : 'http://localhost:3000';

const corsOptions = {
  origin: (originUrl),
    credentials: true,
    methods: ['GET', 'PUT', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}
server.use(morgan());
server.use(express.json());
server.use(cors(corsOptions));
server.use(helmet());
server.use(passport.initialize());
server.use(passport.session());

// routes begin
server.use('/api/employers', employerRouter);
server.use('/api/seekers', seekerRouter);
server.use('/api/billing', billingRouter);
// routes end

module.exports = server;
