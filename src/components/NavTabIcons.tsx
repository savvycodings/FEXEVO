import { Platform, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

type NavIconProps = {
  color: string
  size?: number
}

const androidNoCollapse =
  Platform.OS === 'android' ? ({ collapsable: false } as const) : {}

export function NavIconMyStudents({ color, size = 24 }: NavIconProps) {
  return (
    <View accessibilityLabel="My Students" {...androidNoCollapse}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15.5 11C15.5 9.067 13.933 7.5 12 7.5C10.067 7.5 8.5 9.067 8.5 11C8.5 12.933 10.067 14.5 12 14.5C13.933 14.5 15.5 12.933 15.5 11Z"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M15.483 11.3499C15.805 11.4475 16.1465 11.5 16.5003 11.5C18.4333 11.5 20.0003 9.933 20.0003 8C20.0003 6.067 18.4333 4.5 16.5003 4.5C14.6854 4.5 13.1931 5.8814 13.0176 7.65013"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M10.9827 7.65013C10.8072 5.8814 9.31492 4.5 7.5 4.5C5.567 4.5 4 6.067 4 8C4 9.933 5.567 11.5 7.5 11.5C7.85381 11.5 8.19535 11.4475 8.51727 11.3499"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M22 16.5C22 13.7386 19.5376 11.5 16.5 11.5"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M17.5 19.5C17.5 16.7386 15.0376 14.5 12 14.5C8.96243 14.5 6.5 16.7386 6.5 19.5"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M7.5 11.5C4.46243 11.5 2 13.7386 2 16.5"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

export function NavIconMyCoach({ color, size = 24 }: NavIconProps) {
  return (
    <View accessibilityLabel="My Coach" {...androidNoCollapse}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M11.9708 1.5C14.3992 1.5 16.7307 1.77833 18.8984 2.29009C19.5531 2.44465 20 3.0391 20 3.71179V18.9419C20 19.7955 19.387 20.5252 18.5499 20.6921C16.477 21.1054 12.8251 21.9305 12 22.7555C11.175 21.9305 7.52304 21.1054 5.4501 20.6921C4.61298 20.5252 4 19.7955 4 18.9419V3.69821C4 3.02429 4.44851 2.42906 5.10475 2.27569C7.25505 1.77313 9.56543 1.5 11.9708 1.5Z"
          stroke={color}
          strokeWidth={1.5}
        />
        <Path
          d="M11.1114 13.9939C11.1983 13.9939 11.2778 14.0469 11.3146 14.1304L11.4493 14.4357C11.4861 14.5192 11.4732 14.6176 11.4172 14.6879L10.4003 15.9628C10.3792 15.989 10.3529 16.0102 10.3234 16.0247L9.6861 16.3374C9.65663 16.3519 9.62387 16.3596 9.59121 16.3596H6.85155C6.76466 16.3596 6.68581 16.3065 6.64895 16.2231L6.51431 15.9178C6.47748 15.8343 6.48978 15.7359 6.54572 15.6656L7.56323 14.3906C7.58427 14.3646 7.61024 14.3432 7.63953 14.3288L8.27748 14.0161C8.30695 14.0015 8.33907 13.9939 8.37173 13.9939H11.1114Z"
          fill={color}
        />
        <Path
          d="M14.1671 11.7499C14.2331 11.7499 14.2958 11.7808 14.3383 11.8339L17.396 15.6656C17.4519 15.7359 17.4642 15.8343 17.4274 15.9178L17.2928 16.2231C17.2559 16.3062 17.177 16.3595 17.0901 16.3596H14.3499C14.3173 16.3596 14.285 16.3519 14.2556 16.3374L13.6183 16.0247C13.5889 16.0102 13.5625 15.989 13.5414 15.9628L12.2046 14.2871C12.1707 14.2445 12.152 14.1902 12.152 14.1344V13.854C12.152 13.7983 12.1707 13.7439 12.2046 13.7014L13.6946 11.8339C13.7371 11.7807 13.7998 11.7499 13.8658 11.7499H14.1671Z"
          fill={color}
        />
        <Path
          d="M17.0901 6.5C17.177 6.50003 17.2559 6.5534 17.2928 6.63651L17.4274 6.94181C17.4642 7.02522 17.4518 7.12372 17.396 7.19398L14.3332 11.033C14.3121 11.0591 14.2856 11.0804 14.2562 11.0949L13.6189 11.4076C13.5895 11.4221 13.5574 11.4298 13.5247 11.4298H10.7844C10.6975 11.4298 10.618 11.3759 10.5811 11.2926L10.4471 10.9873C10.4103 10.9038 10.4226 10.8054 10.4786 10.7351L13.5414 6.89675C13.5624 6.87068 13.5889 6.84936 13.6183 6.83488L14.2556 6.52219C14.2851 6.50767 14.3172 6.5 14.3499 6.5H17.0901Z"
          fill={color}
        />
        <Path
          d="M9.59185 6.5C9.62422 6.50002 9.65667 6.50769 9.6861 6.52219L10.3234 6.83556C10.353 6.85007 10.3793 6.87103 10.4003 6.89742L11.4172 8.17173C11.4732 8.24194 11.486 8.34046 11.4493 8.4239L11.3146 8.72987C11.278 8.813 11.1985 8.86638 11.1114 8.86638H8.37173C8.33935 8.86638 8.30692 8.85868 8.27748 8.84419L7.63953 8.5315C7.60987 8.51698 7.58432 8.49537 7.56323 8.46896L6.54572 7.19465C6.48973 7.12438 6.47747 7.02598 6.51431 6.94248L6.64895 6.63718C6.68554 6.55394 6.76437 6.5 6.85155 6.5H9.59185Z"
          fill={color}
        />
      </Svg>
    </View>
  )
}

/** Bottom nav: active = white, inactive = blue — stroke follows `color` */
export function NavIconAICoach({ color, size = 24 }: NavIconProps) {
  return (
    <View {...androidNoCollapse}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.1706 20.8905C18.3536 20.6125 21.6856 17.2332 21.9598 12.9909C22.0134 12.1607 22.0134 11.3009 21.9598 10.4707C21.6856 6.22838 18.3536 2.84913 14.1706 2.57107C12.7435 2.47621 11.2536 2.47641 9.8294 2.57107C5.64639 2.84913 2.31441 6.22838 2.04024 10.4707C1.98659 11.3009 1.98659 12.1607 2.04024 12.9909C2.1401 14.536 2.82343 15.9666 3.62791 17.1746C4.09501 18.0203 3.78674 19.0758 3.30021 19.9978C2.94941 20.6626 2.77401 20.995 2.91484 21.2351C3.05568 21.4752 3.37026 21.4829 3.99943 21.4982C5.24367 21.5285 6.08268 21.1757 6.74868 20.6846C7.1264 20.4061 7.31527 20.2668 7.44544 20.2508C7.5756 20.2348 7.83177 20.3403 8.34401 20.5513C8.8044 20.7409 9.33896 20.8579 9.8294 20.8905C11.2536 20.9852 12.7435 20.9854 14.1706 20.8905Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M7.5 15L9.34189 9.47434C9.43631 9.19107 9.7014 9 10 9C10.2986 9 10.5637 9.19107 10.6581 9.47434L12.5 15M15.5 9V15M8.5 13H11.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
    </View>
  )
}

export function NavIconActivities({ color, size = 24 }: NavIconProps) {
  return (
    <View {...androidNoCollapse}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 2V6M8 2V6"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 10H21"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
    </View>
  )
}

export function NavIconProgress({ color, size = 24 }: NavIconProps) {
  return (
    <View {...androidNoCollapse}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22C16.1421 22 19.5 18.6421 19.5 14.5C19.5 13.5 19.5 11.5 17.5 9C17.5 9 17.4004 11.8536 15.4262 11.4408C12.2331 10.7732 16.3551 4.50296 10.5 2C10.5 7 4.5 8.5 4.5 14.5C4.5 18.6421 7.85786 22 12 22Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M12 19.0011C13.933 19.0011 15.5 16.9864 15.5 14.5011C12.3 15.7011 11.1667 12.9379 11 11C9.55426 11.5532 8.5 13.8256 8.5 15C8.5 17.4853 10.067 19.0011 12 19.0011Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
    </View>
  )
}

export function NavIconYou({ color, size = 24 }: NavIconProps) {
  return (
    <View {...androidNoCollapse}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.5 10.5C15.5 8.567 13.933 7 12 7C10.067 7 8.5 8.567 8.5 10.5C8.5 12.433 10.067 14 12 14C13.933 14 15.5 12.433 15.5 10.5Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 20C18 16.6863 15.3137 14 12 14C8.68629 14 6 16.6863 6 20"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
    </View>
  )
}
