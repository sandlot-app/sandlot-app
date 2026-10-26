import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// icons.download, medium / outline / round, as the Figma nav bar uses.

function Icon({ color, children }: { color: string; children: React.ReactNode }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24" color={color}
    accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={Platform.OS === 'web' ? true : undefined}>
    {children}
  </Svg>;
}

export function CaretLeftIcon({ color }: { color: string }) {
  return <Icon color={color}>
    <Path fill="currentColor" d="M15.4637 5.4593L8.923 12L15.4637 18.5408C15.5126 18.5896 15.5553 18.6422 15.5919 18.6976C15.8482 19.0858 15.8054 19.6133 15.4637 19.955C15.0732 20.3455 14.4401 20.3455 14.0495 19.955L6.80168 12.7071C6.61415 12.5196 6.50879 12.2653 6.50879 12C6.50879 11.7348 6.61415 11.4805 6.80168 11.2929L14.0495 4.04509C14.4401 3.65457 15.0732 3.65457 15.4637 4.04509C15.8543 4.43561 15.8543 5.06878 15.4637 5.4593Z" />
  </Icon>;
}

export function UserIcon({ color }: { color: string }) {
  return <Icon color={color}>
    <Path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7ZM14 7C14 8.10457 13.1046 9 12 9C10.8954 9 10 8.10457 10 7C10 5.89543 10.8954 5 12 5C13.1046 5 14 5.89543 14 7Z" />
    <Path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M20 17.1666C20 16.7333 19.8642 16.3074 19.5815 15.979C17.7477 13.8488 15.0313 12.5 12 12.5C8.96866 12.5 6.25235 13.8488 4.41847 15.979C4.13576 16.3074 4 16.7333 4 17.1666V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17.1666ZM18 17.2083C16.5313 15.5445 14.3887 14.5 12 14.5C9.61132 14.5 7.46872 15.5445 6 17.2083V19H18V17.2083ZM6.00017 17.1622C6.00017 17.1622 6.00018 17.1622 6.00017 17.1623C6.00016 17.1624 6.00015 17.1625 6.00012 17.1627C6.00014 17.1625 6.00016 17.1623 6.00017 17.1622Z" />
  </Icon>;
}
