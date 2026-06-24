const PDFDocument = require('pdfkit');

const GREEN = '#0b6b3a';
const DARK = '#222222';

function fmtDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const h = Math.floor(m / 60);
  if (h) return `${h}h ${m % 60}m`;
  return `${m}m ${s}s`;
}

/**
 * Stream a match report PDF to the HTTP response.
 * `match` must be populated with participants.player and teams.team.
 */
function generateMatchReport(match, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  // Header
  doc.fillColor(GREEN).fontSize(22).text('Snooker Century Scoring System', { align: 'center' });
  doc.moveDown(0.2);
  doc.fillColor(DARK).fontSize(14).text('Match Report', { align: 'center' });
  doc.moveDown(1);

  const line = () => {
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.5);
  };

  const section = (title) => {
    doc.moveDown(0.5);
    doc.fillColor(GREEN).fontSize(13).text(title);
    doc.fillColor(DARK).fontSize(11);
    line();
  };

  const kv = (k, v) => doc.fontSize(11).fillColor(DARK).text(`${k}: `, { continued: true }).fillColor('#555').text(String(v));

  // Match information
  section('Match Information');
  kv('Match Name', match.name);
  kv('Date', new Date(match.date).toLocaleString());
  kv('Venue', match.location || '-');
  kv('Mode', match.mode === 'solo' ? 'Solo' : 'Team');
  kv('Duration', fmtDuration(match.durationSeconds || 0));
  if (match.notes) kv('Notes', match.notes);

  // Participants & scores
  section('Participants & Scores');
  if (match.mode === 'team') {
    const totals = match.teamScores();
    match.teams.forEach((t) => {
      kv(`Team ${t.side} (${t.team?.name || 'Team'})`, `${totals[t.side] || 0} pts`);
    });
    doc.moveDown(0.3);
  }
  match.participants
    .slice()
    .sort((a, b) => b.score - a.score)
    .forEach((p) => {
      const name = p.player?.name || 'Player';
      const side = p.teamSide ? ` [Team ${p.teamSide}]` : '';
      kv(`${name}${side}`, `${p.score} pts  |  HB ${p.highestBreak}  |  100s ${p.centuryCount}  |  50s ${p.halfCenturyCount}`);
    });

  // Statistics
  section('Statistics');
  const allBreaks = match.participants.map((p) => p.highestBreak);
  kv('Highest Break (match)', Math.max(0, ...allBreaks));
  kv('Total Centuries', match.participants.reduce((s, p) => s + p.centuryCount, 0));
  kv('Total Half-Centuries', match.participants.reduce((s, p) => s + p.halfCenturyCount, 0));
  kv('Total Fouls', match.participants.reduce((s, p) => s + p.foulCount, 0));
  kv('Total Misses', match.participants.reduce((s, p) => s + p.missCount, 0));

  if (match.achievements?.length) {
    section('Century Achievements');
    match.achievements.forEach((a) => {
      const name = match.participants.find((p) => String(p.player?._id || p.player) === String(a.player))?.player?.name || 'Player';
      doc.fontSize(11).fillColor(DARK).text(`• ${name} — ${a.type === 'century' ? 'Century' : 'Half-Century'} (${a.breakValue})`);
    });
  }

  // Result
  section('Result');
  kv('Winner', match.winner?.label || '-');
  kv('Final Score', match.finalScore || '-');

  doc.moveDown(2);
  doc.fontSize(9).fillColor('#999').text(`Generated ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(9).fillColor(GREEN).text('Developed by Alphide Developers', { align: 'center' });

  doc.end();
}

module.exports = generateMatchReport;
