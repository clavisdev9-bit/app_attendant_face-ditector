import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';

const SimplebarReactClient = ({ children, className, ...props }) => {
  return (
    <SimpleBar className={className} {...props}>
      {children}
    </SimpleBar>
  );
};

export default SimplebarReactClient;
