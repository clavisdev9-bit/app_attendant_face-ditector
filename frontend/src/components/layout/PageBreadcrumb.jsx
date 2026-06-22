import IconifyIcon from '../wrappers/IconifyIcon';

const PageBreadcrumb = ({ title, subName }) => {
  return (
    <div className="row">
      <div className="col-12">
        <div className="page-title-box">
          <h4 className="mb-0 fw-semibold">{title}</h4>
          <ol className="breadcrumb mb-0 align-items-center">
            <li className="breadcrumb-item icons-center">
              <span>{subName}</span>
              <div className="ms-1" style={{ height: 24 }}>
                <IconifyIcon icon="bx:chevron-right" height={16} width={16} />
              </div>
            </li>
            <li className="breadcrumb-item active content-none">{title}</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default PageBreadcrumb;
