import { Icon } from '@iconify/react';

const IconifyIcon = ({ icon, className, height, width, ...props }) => {
  return <Icon icon={icon} className={className} height={height} width={width} {...props} />;
};

export default IconifyIcon;
