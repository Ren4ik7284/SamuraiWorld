// Vercel Serverless API for Support Tickets (Zero external dependency, 100% reliable)
let globalTickets = [];

export default function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { method, query, body } = req;

  if (method === 'GET') {
    return res.status(200).json(globalTickets);
  }

  if (method === 'POST') {
    const ticket = body;
    if (!ticket || !ticket.id) {
      return res.status(400).json({ error: 'Invalid ticket payload' });
    }
    // Remove duplicates if existing
    globalTickets = globalTickets.filter((t) => t.id !== ticket.id && t._id !== ticket._id);
    globalTickets.unshift(ticket);
    return res.status(201).json(ticket);
  }

  if (method === 'PUT') {
    const { id } = query;
    const ticketId = id || body.id;
    const index = globalTickets.findIndex((t) => t.id === ticketId || t._id === ticketId);
    if (index !== -1) {
      globalTickets[index] = { ...globalTickets[index], ...body };
      return res.status(200).json(globalTickets[index]);
    }
    return res.status(404).json({ error: 'Ticket not found' });
  }

  if (method === 'DELETE') {
    const { id } = query;
    const ticketId = id || body?.id;
    globalTickets = globalTickets.filter((t) => t.id !== ticketId && t._id !== ticketId);
    return res.status(200).json({ success: true, id: ticketId });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
