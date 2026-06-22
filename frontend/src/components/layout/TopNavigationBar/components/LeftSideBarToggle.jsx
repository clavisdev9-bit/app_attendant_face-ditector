import IconifyIcon from '../../../wrappers/IconifyIcon';
import { useLayoutContext } from '../../../../context/useLayoutContext';

const LeftSideBarToggle = () => {
  const { menu: { size }, changeMenu: { size: changeMenuSize }, toggleBackdrop } = useLayoutContext();

  const handleMenuSize = () => {
    if (size === 'hidden') { toggleBackdrop(); return; }
    if (size === 'condensed') changeMenuSize('default');
    else if (size === 'default') changeMenuSize('condensed');
    else changeMenuSize('condensed');
  };

  return (
    <div className="topbar-item">
      <button onClick={handleMenuSize} type="button" className="button-toggle-menu">
        <IconifyIcon icon="iconamoon:menu-burger-horizontal" className="fs-22" />
      </button>
    </div>
  );
};

export default LeftSideBarToggle;
