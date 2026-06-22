import { currentYear, appName } from '../../context/constants';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12 text-center">
            <span>
              {currentYear} &copy; {appName} &mdash; Attendance Management System
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
