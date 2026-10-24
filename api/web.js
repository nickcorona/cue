import { authorized } from './mcp.js';
import { renderPage } from '../lib/ui.js';

export default function handler(req, res) {
  if (!authorized(req.query.key)) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.status(200).send(renderPage({ key: req.query.key }));
}
