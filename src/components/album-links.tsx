import { siDiscogs, siSpotify, type SimpleIcon } from "simple-icons";

function BrandIcon({ icon }: { icon: SimpleIcon }) {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
      <path d={icon.path} />
    </svg>
  );
}

export function AlbumLinks({
  artist,
  title,
}: {
  artist: string;
  title: string;
}) {
  const q = (artist: string, title: string) =>
    encodeURIComponent(`${artist} ${title}`);

  const searchLinks = (artist: string, title: string) => [
    {
      site: "Spotify",
      icon: siSpotify,
      url: `https://open.spotify.com/search/${q(artist, title)}`,
    },
    {
      site: "Discogs",
      icon: siDiscogs,
      url: `https://www.discogs.com/search/?q=${q(artist, title)}&type=master`,
    },
  ];

  return (
    <div className="flex my-4">
      <ul className="flex gap-2">
        {searchLinks(artist, title).map(({ icon, site, url }) => (
          <li key={site}>
            <a
              href={url}
              aria-label={`Search ${site} for ${title}`}
              target="_blank"
              rel="noopener noreferrer"
              className="grid size-7 place-items-center rounded-full bg-(--btn-bg) text-(--btn-fg) transition-opacity hover:opacity-80"
            >
              <BrandIcon icon={icon} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
