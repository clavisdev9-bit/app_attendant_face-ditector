import clsx from 'clsx';

export default function Card({ className, children, noPad = false }) {
  return (
    <div className={clsx('card', className)}>
      {noPad ? children : <div className="card-body">{children}</div>}
    </div>
  );
}

Card.Header = function CardHeader({ title, action, className }) {
  return (
    <div className={clsx('card-header', className)}>
      <h3 className="card-title">{title}</h3>
      {action && <div>{action}</div>}
    </div>
  );
};

Card.Body = function CardBody({ className, children }) {
  return <div className={clsx('card-body', className)}>{children}</div>;
};
