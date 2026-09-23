import './playerName.css';

export default function PlayerName({ displayName, jerseyNumber }) {
  const number = String(jerseyNumber ?? '').trim();
  return (
    <>
      {displayName}
      {number !== '' && <span className="player-jersey-number" title={`Player number ${number}`}> #{number}</span>}
    </>
  );
}
