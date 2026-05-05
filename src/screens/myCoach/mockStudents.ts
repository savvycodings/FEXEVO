import type { MyCoachStudent } from './types'

const PFP1 = require('../../../assets/coachs/img1.png')
const PFP2 = require('../../../assets/coachs/img2.png')
const PFP3 = require('../../../assets/coachs/img5.png')

/** Placeholder roster matching legacy “My Coach” home layout. */
export const MY_COACH_MOCK_STUDENTS: MyCoachStudent[] = [
  {
    id: '1',
    name: 'Carlos Montana',
    location: 'Buenos Aires, Argentina',
    actualScore: 92,
    lastScore: 85,
    avatar: PFP1,
    notiRow: 'pin-msg-noti',
  },
  {
    id: '2',
    name: 'Edward Staris',
    location: 'Madrid, Spain',
    actualScore: 72,
    lastScore: 71,
    avatar: PFP2,
    notiRow: 'noti-only',
  },
  {
    id: '3',
    name: 'Sara Conor',
    location: 'Miami, USA',
    actualScore: 86,
    lastScore: 54,
    avatar: PFP3,
    notiRow: 'none',
  },
]
