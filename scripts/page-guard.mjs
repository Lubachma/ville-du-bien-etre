// Publication guard: index.html asks nothing of the network. The only absolute addresses it may hold are
// the metadata that name the published site (canonical address, link previews): robots and messaging
// apps read them, the app never loads them. A tag is recognized whatever the order of its attributes.
const METADATA = [
  /<meta\b(?=[^>]*\sproperty="og:)[^>]*>/gi,
  /<meta\b(?=[^>]*\sname="twitter:)[^>]*>/gi,
  /<link\b(?=[^>]*\srel="canonical")[^>]*>/gi,
];

// The http:// and https:// addresses left once the metadata tags are removed, in document order.
export function strayAddresses(html) {
  // A space, not '': what surrounds a removed tag must not be glued into a new address.
  const rest = METADATA.reduce((text, tag) => text.replace(tag, ' '), html);
  return rest.match(/https?:\/\/[^\s"'<>)]+/gi) ?? [];
}
