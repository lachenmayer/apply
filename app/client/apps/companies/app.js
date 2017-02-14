const {pull, html} = require('inu')
const u = require('updeep')

const action = require('../../lib/action')
const api = require('../../lib/api')
const Component = require('../../lib/component')

const authenticate = require('../../components/authenticate')
const link = require('../../components/link')
const selectField = require('../../components/selectField')
const textArea = require('../../components/textArea')

module.exports = Component({
  children: {
    authenticate,
    firstChoice: selectField([]),
    secondChoice: selectField([]),
    thirdChoice: selectField([]),
    comment: textArea(),
  },
  init () {
    return {
      model: {
        user: null,
        unauthorized: false,
        companies: [],
      },
      effect: action('waitForUser'),
    }
  },
  update (model, {type, payload}) {
    switch (type) {
      case 'authenticated': {
        const newModel = u({user: payload}, model)
        return {model: newModel, effect: action('fetchCompanies')}
      }

      case 'fetchCompaniesSuccess': {
        const companies = payload.companies
        const newModel = u({companies}, model)
        return {model: newModel, effect: action('replaceCompaniesLists', companies)}
      }
      case 'fetchCompaniesUnauthorized': {
        const newModel = u({unauthorized: true}, model)
        return {model: newModel, effect: null}
      }

      case 'submitPreferences': {
        const preferences = {
          firstChoice: model.children.firstChoice.value,
          secondChoice: model.children.secondChoice.value,
          thirdChoice: model.children.thirdChoice.value,
          comment: model.children.comment.value,
        }
        return {model, effect: action('submitPreferences', preferences)}
      }

      case 'fetchCompaniesFailure':
        console.error({type, payload})
      default:
        return {model, effect: null}
    }
  },
  view (model, dispatch, children) {
    const {
      user,
    } = model
    return html`
      <div class="companies">
        <h1>Apply to HackCampus</h1>
        <p>If you have been shortlisted for this year's internship programme, you will be able to see which companies we are working with this year. You will be able to choose your preferred companies here, and we will do our best to match you with the companies you have chosen. Note that it is up to the companies to decide which applicants they want to interview, so you may be matched with a company that you did not specifically choose as a preference here.</p>
        <h2>Step 0: Authenticate</h2>
        ${children.authenticate()}
        ${user ? this.step1View(model, dispatch, children) : ''}
        ${user ? this.step2View(model, dispatch, children) : ''}
      </div>
    `
  },
  step1View (model, dispatch, children) {
    const {
      unauthorized,
      companies,
    } = model
    return html`<div class="step1">
      <h2>Step 1: Check out this year's companies</h2>
      ${unauthorized
        ? html`<p class="error">We're sorry, at this stage of the application process you can not give us your company preferences. If you think that this is an error, please let us know by email.</p>`
        : html`<div class="companiesList">
          ${companies.map(company => this.companyView(company))}
        </div>`}
    </div>`
  },
  step2View (model, dispatch, children) {
    return html`<div class="step2">
      <h2>Step 2: Tell us your preferences</h2>
      <p>You can leave any of the choices blank if you don't have any strong preferences.</p>
      <p><strong>First choice:</strong><br />${children.firstChoice()}</p>
      <p><strong>Second choice:</strong><br />${children.secondChoice()}</p>
      <p><strong>Third choice:</strong><br />${children.thirdChoice()}</p>
      <p><strong>Any further comments?</strong><br />${children.comment()}</p>
      <p>${link('Submit your preferences', () => dispatch(action('submitPreferences')))}</p>
    </div>`
  },
  companyView (company) {
    const {
      name,
      website,
      description,
      stack,
    } = company
    return html`<div class="company">
      <h3>${name}</h3>
      <p class="company-description"><strong>Description:</strong> ${description}</p>
      <p class="company-website"><strong>Website:</strong> <a href="${website}">${website}</a></p>
      <p class="company-stack"><strong>Stack:</strong> ${stack.join(', ')}</p>
    </div>`
  },
  run (effect, sources, action) {
    const get = (url, handler) =>
      pull(api.get(url), pull.map(handler))
    const put = (url, body, handler) =>
      pull(api.put(url, body), pull.map(handler))
    switch (effect.type) {
      case 'waitForUser': {
        return pull(
          sources.models(),
          pull.map(model => model.children.authenticate.user),
          pull.filter(user => user != null),
          pull.take(1),
          pull.map(user => action('authenticated', user))
        )
      }
      case 'fetchCompanies': {
        return get('/companies', ({statusText, data}) => {
          switch (statusText) {
            case 'OK': return action('fetchCompaniesSuccess', data)
            case 'Unauthorized': return action('fetchCompaniesUnauthorized')
            default: return action('fetchCompaniesFailure', data)
          }
        })
      }
      case 'replaceCompaniesLists': {
        const companyNames = (effect.payload || []).map(company => company.name)
        this.replaceChild('firstChoice', selectField(companyNames))
        this.replaceChild('secondChoice', selectField(companyNames))
        return this.replaceChild('thirdChoice', selectField(companyNames))
      }
      case 'submitPreferences': {
        const preferences = effect.payload
        return put('/me/companies', preferences, ({statusText, data}) => {
          switch (statusText) {
            case 'OK': return action('submitPreferencesSuccess', data)
            default: return action('submitPreferencesFailure', data)
          }
        })
      }
    }
  }
})
