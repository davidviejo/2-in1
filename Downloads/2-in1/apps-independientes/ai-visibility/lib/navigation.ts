export type NavItem = {
  label: string;
  href: string;
};

export const navItems: NavItem[] = [
  { label: 'Overview', href: '/' },
  { label: 'Prompts', href: '/prompts' },
  { label: 'Responses', href: '/responses' },
  { label: 'Citations', href: '/citations' },
  { label: 'Competitors', href: '/competitors' },
  { label: 'Tags', href: '/tags' },
  { label: 'Settings', href: '/settings' }
];
