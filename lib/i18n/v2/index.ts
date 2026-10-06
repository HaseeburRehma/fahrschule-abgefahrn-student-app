import * as ds from './ds'
import * as auth from './auth'
import * as home from './home'
import * as theory from './theory'
import * as schedule from './schedule'
import * as profile from './profile'
import * as admin from './admin'

const areas = [ds, auth, home, theory, schedule, profile, admin]

export const V2 = {
  de: Object.assign({}, ...areas.map((a) => a.de)) as Record<string, string>,
  en: Object.assign({}, ...areas.map((a) => a.en)) as Record<string, string>,
}
