import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { tools } from "../tools/registry";
import { isAdmin, logout } from "../api/auth";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="shell">
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <h2>MyAgent</h2>
        <nav>
          <ul>
            <li>
              <NavLink to="/" end>
                Home
              </NavLink>
            </li>
            {tools.map((tool) => {
              if (tool.path === "/admin" && !isAdmin()) return null;
              return (
                <li key={tool.path}>
                  <NavLink to={tool.path}>{tool.name}</NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <button
          className="sidebar-btn logout-sidebar-btn"
          type="button"
          onClick={handleLogout}
        >
          {collapsed ? "X" : "Logout"}
        </button>
        <button
          className="sidebar-btn collapse-btn"
          type="button"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? ">" : "<"} <span>collapse</span>
        </button>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
