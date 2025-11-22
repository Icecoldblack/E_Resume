import React from 'react';
import { Link, NavLink } from 'react-router-dom';

const Navbar: React.FC = () => {
  return (
    <header className="navbar">
      <div className="navbar-left">
        <Link to="/" className="navbar-logo">
          EasePath
        </Link>
      </div>
      <nav className="navbar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}>
          Dashboard
        </NavLink>
        <NavLink to="/auto-apply" className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}>
          Auto Apply
        </NavLink>
      </nav>
    </header>
  );
};

export default Navbar;
