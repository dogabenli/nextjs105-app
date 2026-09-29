export interface MemberNavLink {
  href: string;
  label: string;
}

// UX-only convenience nav. Sitecore item security remains the authoritative access control -
// a role missing here (e.g. because the token couldn't be decoded) simply hides the link.
export function getVisibleMemberLinks(roles: string[]): MemberNavLink[] {
  const links: MemberNavLink[] = [];

  if (roles.includes('member-basic')) {
    links.push({ href: '/member/page-1', label: 'Basic Page' });
  }
  if (roles.includes('member-premium')) {
    links.push({ href: '/member/page-2', label: 'Premium Page' });
  }
  // page-3 is visible to every authenticated member, including users with no mapped role.
  links.push({ href: '/member/page-3', label: 'All Members Page' });

  return links;
}
