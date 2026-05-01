import { Link } from "react-router-dom";
import { tools } from "./registry";

export default function HomePage() {
  return (
    <>
      <h1>MyAgent Tools</h1>
      <ul>
        {tools.map((tool) => (
          <li key={tool.path}>
            <Link to={tool.path}>
              <strong>{tool.name}</strong>
            </Link>{" "}
            - {tool.description}
          </li>
        ))}
      </ul>
    </>
  );
}
