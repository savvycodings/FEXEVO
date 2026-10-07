/** Camera angles offered when uploading a clip, with their picker tile and example-motion video. */
export type CameraAngleId =
  | 'front'
  | 'behind'
  | 'side'
  | 'deg45_right_side_left_camera'
  | 'deg45_right_side_right_camera'
  | 'deg45_left_side_right_camera'
  | 'deg45_left_side_left_camera'

export type CameraAngle = {
  id: CameraAngleId
  /** Full tile artwork (background, diagram and label baked in). */
  tile: number
  tileWidth: number
  tileHeight: number
  video: number
  labelKey: string
  hintKey: string
}

export const CAMERA_ANGLES: CameraAngle[] = [
  {
    id: 'front',
    tile: require('../../assets/angelvideo/angleimages/front.png'),
    tileWidth: 117,
    tileHeight: 155,
    video: require('../../assets/angelvideo/Front.mp4'),
    labelKey: 'studentProfile.views.front',
    hintKey: 'studentProfile.viewHints.front',
  },
  {
    id: 'behind',
    tile: require('../../assets/angelvideo/angleimages/back.png'),
    tileWidth: 117,
    tileHeight: 155,
    video: require('../../assets/angelvideo/behind.mp4'),
    labelKey: 'studentProfile.views.behind',
    hintKey: 'studentProfile.viewHints.behind',
  },
  {
    id: 'side',
    tile: require('../../assets/angelvideo/angleimages/side.png'),
    tileWidth: 117,
    tileHeight: 155,
    video: require('../../assets/angelvideo/side.mp4'),
    labelKey: 'studentProfile.views.side',
    hintKey: 'studentProfile.viewHints.side',
  },
  {
    id: 'deg45_right_side_left_camera',
    tile: require('../../assets/angelvideo/angleimages/rightsideleftcam.png'),
    tileWidth: 85,
    tileHeight: 132,
    video: require('../../assets/angelvideo/45rightsideleftcamera.mp4'),
    labelKey: 'studentProfile.views.deg45RightSideLeftCamera',
    hintKey: 'studentProfile.viewHints.deg45RightSideLeftCamera',
  },
  {
    id: 'deg45_right_side_right_camera',
    tile: require('../../assets/angelvideo/angleimages/rightsiderightcam.png'),
    tileWidth: 85,
    tileHeight: 132,
    video: require('../../assets/angelvideo/45rightsiderightcamera.mp4'),
    labelKey: 'studentProfile.views.deg45RightSideRightCamera',
    hintKey: 'studentProfile.viewHints.deg45RightSideRightCamera',
  },
  {
    id: 'deg45_left_side_right_camera',
    tile: require('../../assets/angelvideo/angleimages/leftsiderightcam.png'),
    tileWidth: 85,
    tileHeight: 132,
    video: require('../../assets/angelvideo/45leftsiderightcamera.mp4'),
    labelKey: 'studentProfile.views.deg45LeftSideRightCamera',
    hintKey: 'studentProfile.viewHints.deg45LeftSideRightCamera',
  },
  {
    id: 'deg45_left_side_left_camera',
    tile: require('../../assets/angelvideo/angleimages/leftsideleftcam.png'),
    tileWidth: 85,
    tileHeight: 132,
    video: require('../../assets/angelvideo/45leftsideleftcamera.mp4'),
    labelKey: 'studentProfile.views.deg45LeftSideLeftCamera',
    hintKey: 'studentProfile.viewHints.deg45LeftSideLeftCamera',
  },
]

export function cameraAngleById(id: CameraAngleId): CameraAngle {
  return CAMERA_ANGLES.find((a) => a.id === id) ?? CAMERA_ANGLES[0]!
}
