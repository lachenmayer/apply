const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const express = require('express')
const session = require('express-session')
const fs = require('fs')
const http = require('http')
const morgan = require('morgan')
const path = require('path')
const status = require('statuses')

const errorHandler = require('./middlewares/errors')
const validateRequest = require('./middlewares/validate')

const auth = require('./auth')
const config = require('../config')
const errors = require('./errors')
const {Authentication, Database, User} = require('./models')
const wireFormats = require('./wireFormats')

const port = process.env.PORT || 3000
const app = express()

app.use(morgan('dev'))
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
}))
app.use(bodyParser.json())
app.use(cookieParser())
app.use('/static', express.static(path.join(__dirname, 'build')))
app.disable('x-powered-by')
auth(app)

// register
// errors:
// 0. junk in
// 1. email already exists
app.post('/users', validateRequest(wireFormats.register) /*0*/, (req, res, handleError) => {
  const {email, password} = req.body
  User.createWithPassword(email, password)
  .then(user => { res.status(status('Created')).json(user.toJSON()) })
  .catch(error => {
    if (error.constraint === 'users_email_unique') { /*1*/
      return handleError({status: 'Conflict', error: errors.emailTaken})
    }
    return handleError({status: 'Unknown', error})
  })
})

app.get('/me', (req, res, handleError) => {
  if (req.user) {
    User.where({id: req.user.id}, {withRelated: ['authentication']}).fetch()
    .then(user => {
      user.related('authentication').fetch({columns: ['type']})
      .then(authMethods => {
        res.json({
          id: user.id,
          email: user.email,
          connectedAccounts: authMethods.pluck('type'),
        })
      })
    })
  } else {
    return handleError({status: 'Unauthorized'})
  }
})

// single page app
app.use(require('./shell'))

app.use(errorHandler)

const server = http.createServer(app)
server.listen(port, () => { console.log(port) })
