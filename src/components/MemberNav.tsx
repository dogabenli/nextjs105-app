import { JSX } from 'react';
import Link from 'next/link';
import { MemberNavLink } from 'lib/member-nav';

interface MemberNavProps {
  links: MemberNavLink[];
}

// Rendered only on /member routes; shows the sub-pages the current member's role can see.
const MemberNav = ({ links }: MemberNavProps): JSX.Element => (
  <nav className="d-flex flex-wrap p-3 px-md-4 bg-light border-bottom">
    <Link className="p-2 text-dark" href="/member">
      Member Home
    </Link>
    {links.map((link) => (
      <Link key={link.href} className="p-2 text-dark" href={link.href}>
        {link.label}
      </Link>
    ))}
  </nav>
);

export default MemberNav;
