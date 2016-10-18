const universities = require('./universities')

const authentication = {
  type: 'object',
  properties: {
    type: {enum: ['password', 'github']},
    identifier: {type: 'string'},
    token: {type: 'string'},
  },
  required: ['type', 'token'],
}

const password = {type: 'string', minLength: 6, maxLength: 72}

const register = {
  type: 'object',
  properties: {
    email: {type: 'string', format: 'email'},
    password,
  },
  required: ['email', 'password'],
}

const personalDetails = {
  type: 'object',
  properties: {
    firstName: {type: 'string'},
    lastName: {type: 'string'},
    gender: {enum: ['male', 'female', 'other']},
    dateOfBirth: {type: 'string', format: 'date'},
    university: {enum: universities.concat(['other'])},
    otherUniversity: {type: 'string'},
    course: {type: 'string'},
    courseYear: {enum: ['1', '2', '3', '4', '5', 'other']},
    otherCourseYear: {type: 'string'},
    graduationYear: {enum: ['2017', '2018', '2019', '2020', '2021', 'other']},
    otherGraduationYear: {type: 'string'},
  }
}

module.exports = {
  authentication,
  password,
  register,
  personalDetails,
}
