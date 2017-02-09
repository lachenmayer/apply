const {pull, html} = require('inu')
const values = require('object.values')
const u = require('updeep')

const wireFormats = require('../../../wireFormats')

const action = require('../../lib/action')
const api = require('../../lib/api')
const dateFromNow = require('../../lib/dateFromNow')
const Component = require('../../lib/component')

const applicationTable = require('../../components/applicationTable')

const applicationEventTypes = wireFormats.applicationEventTypes

function applicationTab ({type, title, viewTitle, description, excludeColumns, orderBy}) {
  return {
    title,
    view: function (model, dispatch, children) {
      return html`<div class="${type}">
        <h2>${viewTitle}</h2>
        <p>${description ? description() : ''}</p>
        ${children[type]
          ? children[type]()
          : html`<em>Loading...</em>`}
      </div>`
    },
    child: applications => applicationTable(applications, {
      excludeColumns,
      orderBy,
    }),
    effect: action('fetchApplications', type),
  }
}

const applicationTabs = {
  unfinished: applicationTab({
    type: 'unfinished',
    title: 'unfinished',
    viewTitle: 'Unfinished applications',
    description: () => 'Applications that are still in progress by the applicant',
    excludeColumns: ['finishedAt', 'status', 'lastUpdatedAt'],
    orderBy: 'createdAt',
  }),
  finished: applicationTab({
    type: 'finished',
    title: 'finished - ready to vet',
    viewTitle: 'Finished applications',
    description: () => html`<span><em>Finished</em> applications are applications that have not been vetted or matched.</span>`,
    excludeColumns: ['status', 'lastUpdatedAt'],
    orderBy: 'finishedAt',
  }),
  vetted: applicationTab({
    type: 'vetted',
    title: 'vetted',
    viewTitle: 'Vetted applications',
    description: () => html`<span>Applications that have either been <em>shortlisted</em> or <em>rejected</em> after the first stage of the application. We are still waiting for confirmation of company preferences from the applicant at this stage.</span>`,
    excludeColumns: [],
    orderBy: 'lastUpdatedAt',
  }),
  readyToMatch: applicationTab({
    type: 'readyToMatch',
    title: 'ready to match',
    viewTitle: 'Ready to match',
    description: () => html`<span>The applicant has been shortlisted, and has responded with company preferences. Matching suggestions can be added here.</span>`,
    excludeColumns: [],
    orderBy: 'lastUpdatedAt',
  }),
  matching: applicationTab({
    type: 'matching',
    title: 'matching in progress',
    viewTitle: 'Matching in progress',
    description: () => html`<span>The applicant's profile has been sent to a company. Company responses can be tracked here. If a company has rejected a candidate, they will show up here again.</span>`,
    excludeColumns: [],
    orderBy: 'lastUpdatedAt',
  }),
  offer: applicationTab({
    type: 'offer',
    title: 'offer stage',
    viewTitle: 'Offer stage',
    description: () => html`<span>The applicant has been made an offer by a company, but still has to accept/reject it.</span>`,
    excludeColumns: [],
    orderBy: 'lastUpdatedAt',
  }),
  in: applicationTab({
    type: 'in',
    title: 'in',
    viewTitle: 'In the programme',
    description: () => html`<span>The applicant has signed the contract & has an internship for this year.</span>`,
    excludeColumns: [],
    orderBy: 'lastUpdatedAt',
  }),
  out: applicationTab({
    type: 'out',
    title: 'out',
    viewTitle: 'Out of the programme',
    description: () => html`<span>The applicant has chosen not to take part in the programme.</span>`,
    excludeColumns: [],
    orderBy: 'lastUpdatedAt',
  }),
}

const tabs = [
  {
    title: 'news',
    view: function (model, dispatch, children) {
      const {
        events,
      } = model
      return html`<div class="dashboard">
        <h2>Latest matching events</h2>
        ${events
          ? events.map(event => eventView(event))
          : html`<em>Loading events...</em>`}
      </div>`
    },
    effect: action('fetchApplicationEvents'),
  },
].concat(values(applicationTabs))

function eventView (event) {
  const {
    id,
    ts,
    actor,
    applicationId,
    type,
    payload,
  } = event
  return html`<a class="reset" href="/match/application/${applicationId}" target="_blank">
    <div class="event">
      <p><span class="application">application <em>${applicationId /* TODO get actual info */}</em></span> <span class="type">${applicationEventTypes[type] || 'commented'}</span> by <span class="actor">${actor.email}</span></p>
      ${(() => {
        const fields = []
        for (let key in payload) {
          const value = payload[key]
          if (key === 'comment') {
            fields.push(html`<pre class="eventcomment">${value}</pre>`)
          } else {
            fields.push(html`<p><span class="eventmetakey">${key}</span>: <span class="eventmetavalue">${value}</span></p>`)
          }
        }
        return fields
      })()}
      <p><span class="ts">${dateFromNow(ts)}</span></p>
    </div>
  </a>`
}

module.exports = Component({
  children: {}, // will be added dynamically
  init () {
    return {
      model: {
        tab: 0,
        events: null,
      },
      effect: action('fetchApplicationEvents'),
    }
  },
  update (model, a) {
    switch (a.type) {
      case 'changeTab': {
        const tab = a.payload
        const effect = tabs[tab].effect
        const newModel = u({tab}, model)
        return {model: newModel, effect}
      }

      case 'fetchApplicationEventsSuccess': {
        const events = a.payload.events
        const newModel = u({events}, model)
        return {model: newModel, effect: null}
      }

      case 'fetchApplicationsSuccess': {
        const {applications, type} = a.payload
        return {model, effect: action('replaceChild', {
          key: type,
          newChild: applicationTabs[type].child(applications)
        })}
      }

      case 'fetchApplicationEventsFailure':
      case 'fetchApplicationsFailure':
        // TODO
        console.error(a)
      default:
        return {model, effect: null}
    }
  },
  view (model, dispatch, children) {
    const {tab} = model
    const currentTab = tabs[tab]
    return html`
      <div class="match">
        <div class="header">
          <h1>HackCampus matching</h1>
        </div>
        <div class="body">
          <div class="sidebar">
            ${tabs.map(({title}, i) => {
              return html`<div class="menuitem ${i === tab ? 'selected' : 'unselected'}" onclick=${() => dispatch(action('changeTab', i))}>${title}</div>`
            })}
          </div>
          <div class="main">
            ${currentTab.view(model, dispatch, children)}
          </div>
        </div>
      </div>
    `
  },
  run (effect, sources, action) {
    const get = (url, handler) =>
      pull(api.get(url), pull.map(handler))
    switch (effect.type) {
      case 'fetchApplicationEvents': {
        return get('/applications/events', ({statusText, data}) => {
          switch (statusText) {
            case 'OK': return action('fetchApplicationEventsSuccess', data)
            default: return action('fetchApplicationEventsFailure', data)
          }
        })
      }

      case 'fetchApplications': {
        const type = effect.payload
        return get(`/applications/${type}`, ({statusText, data}) => {
          switch (statusText) {
            case 'OK':
              data.type = type
              return action('fetchApplicationsSuccess', data)
            default:
              return action('fetchApplicationsFailure', data)
          }
        })
      }

      case 'replaceChild': {
        const {key, newChild} = effect.payload
        this.replaceChild(key, newChild)
        return pull.once(action('doNothing'))
      }
    }
  }
})
