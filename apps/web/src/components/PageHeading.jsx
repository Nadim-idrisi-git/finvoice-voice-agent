export function PageHeading({ title, subtitle, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="section-kicker">PERSONAL FINANCE</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
