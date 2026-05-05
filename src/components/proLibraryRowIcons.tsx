import Svg, { Circle, Path } from 'react-native-svg'

/** Stroke color for Category / Level / Shot row icons */
const DEFAULT_COLOR = '#006FFF'
const SW = 1.5

/** @app/assets/view/prolibrary.svg — white on blue chip in Pro Library header */
export function ProLibraryHeaderIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 17.9808V12.7075C3 9.07416 3 7.25748 4.09835 6.12874C5.1967 5 6.96447 5 10.5 5C14.0355 5 15.8033 5 16.9017 6.12874C18 7.25748 18 9.07416 18 12.7075V17.9808C18 20.2867 18 21.4396 17.2755 21.8523C15.8724 22.6514 13.2405 19.9852 11.9906 19.1824C11.2657 18.7168 10.9033 18.484 10.5 18.484C10.0967 18.484 9.73425 18.7168 9.00938 19.1824C7.7595 19.9852 5.12763 22.6514 3.72454 21.8523C3 21.4396 3 20.2867 3 17.9808Z"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 2H11C15.714 2 18.0711 2 19.5355 3.46447C21 4.92893 21 7.28595 21 12V18"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

type Props = {
  size?: number
  color?: string
}

/** @app/assets/view/category.svg */
export function ProLibraryCategoryIcon({
  size = 40,
  color = DEFAULT_COLOR,
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path
        d="M23.9591 24.7994C20.3246 25.5294 18.7498 25.625 15.741 27.0919L13.4582 29.45C13.2142 29.694 12.8188 29.694 12.5748 29.45L11.2498 28.125C11.0059 27.881 11.0059 27.4855 11.2498 27.2416L13.5327 24.8834C14.9998 21.875 15.2819 20.4708 16.0092 16.849M28.1445 22.3805C24.9735 25.5518 20.2278 25.9473 17.5447 23.2639C14.8615 20.5805 15.257 15.8345 18.428 12.6633C21.599 9.49207 26.3446 9.09657 29.0279 11.7799C31.711 14.4632 31.3155 19.2092 28.1445 22.3805Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M25.1916 15.6055L25.1827 15.6143M21.4327 19.3757L21.4238 19.3846M25.1827 19.3757L25.1738 19.3846M21.4416 15.6158L21.4327 15.6246"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M25.4168 35.8131C28.5207 35.8131 30.0727 35.8131 31.3153 35.3608C33.3985 34.6026 35.0397 32.9615 35.7978 30.8783C36.2502 29.6356 36.2502 28.0836 36.2502 24.9798M15.4168 35.8131C12.313 35.8131 10.761 35.8131 9.51835 35.3608C7.4351 34.6026 5.79405 32.9615 5.0358 30.8783C4.5835 29.6356 4.5835 28.0836 4.5835 24.9798M15.4168 4.14648C12.313 4.14648 10.761 4.14648 9.51835 4.59878C7.4351 5.35702 5.79405 6.99808 5.0358 9.08133C4.5835 10.324 4.5835 11.876 4.5835 14.9798M25.4168 4.14648C28.5207 4.14648 30.0727 4.14648 31.3153 4.59878C33.3985 5.35702 35.0397 6.99808 35.7978 9.08133C36.2502 10.324 36.2502 11.876 36.2502 14.9798"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** @app/assets/view/level.svg */
export function ProLibraryLevelIcon({ size = 40, color = DEFAULT_COLOR }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path
        d="M5.8335 30C5.8335 27.643 5.8335 26.4645 6.56573 25.7322C7.29796 25 8.47648 25 10.8335 25H11.6668C13.2382 25 14.0238 25 14.512 25.4882C15.0002 25.9763 15.0002 26.762 15.0002 28.3333V36.6667H5.8335V30Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M25 31.6673C25 30.096 25 29.3103 25.4882 28.8222C25.9763 28.334 26.762 28.334 28.3333 28.334H29.1667C31.5237 28.334 32.7022 28.334 33.4345 29.0662C34.1667 29.7985 34.1667 30.977 34.1667 33.334V36.6673H25V31.6673Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.3335 36.666H36.6668"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 26.666C15 24.309 15 23.1305 15.7322 22.3982C16.4645 21.666 17.643 21.666 20 21.666C22.357 21.666 23.5355 21.666 24.2678 22.3982C25 23.1305 25 24.309 25 26.666V36.666H15V26.666Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21.152 4.29677L22.3252 6.66257C22.4852 6.99191 22.9117 7.30779 23.2717 7.36827L25.3982 7.72449C26.758 7.95301 27.078 8.94772 26.098 9.92899L24.4448 11.5958C24.165 11.8781 24.0117 12.4225 24.0983 12.8123L24.5715 14.8757C24.9448 16.5089 24.085 17.1407 22.6518 16.2871L20.6587 15.0975C20.2987 14.8824 19.7055 14.8824 19.3388 15.0975L17.3457 16.2871C15.9192 17.1407 15.0526 16.5021 15.4259 14.8757L15.8992 12.8123C15.9858 12.4225 15.8325 11.8781 15.5525 11.5958L13.8994 9.92899C12.9262 8.94772 13.2395 7.95301 14.5993 7.72449L16.7257 7.36827C17.079 7.30779 17.5057 6.99191 17.6657 6.66257L18.8388 4.29677C19.4788 3.01306 20.5187 3.01306 21.152 4.29677Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** @app/assets/view/shot.svg */
export function ProLibraryShotIcon({ size = 40, color = DEFAULT_COLOR }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 31 31" fill="none">
      <Path
        d="M17.0769 19.4941C12.4741 20.4186 10.4797 20.5397 6.66931 22.3974L3.77834 25.3838C3.46943 25.6928 2.96859 25.6928 2.65968 25.3838L0.981695 23.7057C0.6728 23.3967 0.6728 22.8959 0.981695 22.587L3.87268 19.6005C5.73065 15.7906 6.0879 14.0123 7.00902 9.42564M22.3774 16.4308C18.3616 20.4469 12.3515 20.9478 8.95354 17.5495C5.55557 14.1513 6.0564 8.14086 10.0723 4.12478C14.0881 0.108708 20.098 -0.39216 23.4961 3.00605C26.894 6.40427 26.3932 12.4147 22.3774 16.4308Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.6377 7.84961L18.6265 7.8608M13.8775 12.6243L13.8662 12.6355M18.6265 12.6243L18.6153 12.6355M13.8887 7.8627L13.8775 7.87389"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="25.75" cy="25.918" r="4.25" stroke={color} strokeWidth={SW} />
    </Svg>
  )
}

export type ProLibraryRowIconKind = 'category' | 'level' | 'shot'

export function ProLibraryRowIcon({
  kind,
  size = 36,
  color = DEFAULT_COLOR,
}: {
  kind: ProLibraryRowIconKind
  size?: number
  color?: string
}) {
  switch (kind) {
    case 'category':
      return <ProLibraryCategoryIcon size={size} color={color} />
    case 'level':
      return <ProLibraryLevelIcon size={size} color={color} />
    case 'shot':
      return <ProLibraryShotIcon size={size} color={color} />
  }
}
