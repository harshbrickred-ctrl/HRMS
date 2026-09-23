import './PlaceholderPage.css';

type PlaceholderPageProps = {
  title: string;
  blurb: string;
  upcoming?: string[];
};

export function PlaceholderPage({
  title,
  blurb,
  upcoming = [],
}: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <p className="placeholder-kicker">Coming next</p>
      <h2 className="placeholder-title">{title}</h2>
      <p className="placeholder-blurb">{blurb}</p>
      {upcoming.length > 0 ? (
        <ul className="placeholder-list">
          {upcoming.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
