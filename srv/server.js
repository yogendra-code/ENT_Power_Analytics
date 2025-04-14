const cds = require('@sap/cds');
const cov2ap = require("@cap-js-community/odata-v2-adapter");
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

cds.on('bootstrap', async (app) => {
    app.use(cov2ap());
    app.use(express.json());
    // Configure session middleware
    app.use(session({
        secret: 'your-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false, httpOnly: true, maxAge: 60 * 60 * 1000 } // 1 hour session
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    

    // Passport local strategy
    passport.use(new LocalStrategy(async (username, password, done) => {
        try {
            const db = cds.db;
            let user = await db.run(SELECT.one.from('portal_Power_Analytics_PowerBIPortal_Users').where({ username }).columns(['ID', 'username', 'password']));
            if (!user) return done(null, false, { message: 'Invalid username or password' });
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) return done(null, false, { message: 'Invalid username or password' });
            let userRolesIDs = (await db.run(SELECT.from('portal_Power_Analytics_PowerBIPortal_UserRoles').where({ user_ID:user.ID }).columns(['role_ID']))).map(item=>item.role_ID);
            let roles = (await db.run(SELECT.from('portal_Power_Analytics_PowerBIPortal_Roles').where({ ID: userRolesIDs }).columns(['name']))).map(item=>item.name);
            console.log(roles);
            return done(null, {ID: user.ID, username: user.username, roles});
        } catch (err) {
            return done(err);
        }
    }));

    // Serialize user (store in session)
    passport.serializeUser((user, done) => {
        done(null, user.ID);
    });

    // Deserialize user (retrieve from session)
    passport.deserializeUser(async (id, done) => {
        try {
            const db = cds.db;
            let user = await db.run(SELECT.one.from('portal_Power_Analytics_PowerBIPortal_Users').where({ ID:id }).columns(['ID', 'username']));
            let userRolesIDs = (await db.run(SELECT.from('portal_Power_Analytics_PowerBIPortal_UserRoles').where({ user_ID:user.ID }).columns(['role_ID']))).map(item=>item.role_ID);
            let roles = (await db.run(SELECT.from('portal_Power_Analytics_PowerBIPortal_Roles').where({ ID: userRolesIDs }).columns(['name']))).map(item=>item.name);
            console.log(roles)
            return done(null, {ID: user.ID, username: user.username, roles});
        } catch (err) {
            done(err);
        }
    });

    // Login route
    app.post('/api/Login', (req, res, next) => {
        passport.authenticate('local', (err, user, info) => {
          if (err) return next(err);
          if (!user) {
            return res.status(401).json({ success: false, message: info.message });
          }
          req.logIn(user, (err) => {
            if (err) return next(err);
            return res.json({ success: true, message: 'Logged in successfully', user });
          });
        })(req, res, next);
    });

    // Logout route
    app.post('/api/logout', (req, res) => {
        req.logout((err) => {
            if (err) return res.status(500).send({ error: 'Logout failed' });
            res.send({ message: 'Logged out successfully' });
        });
    });

});

module.exports = cds.server;
