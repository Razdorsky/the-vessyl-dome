import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import { VessylExperience } from "../../app/components/VessylExperience";

const root = document.getElementById("root");

if (!root) {
  throw new Error("The Vessyl root element is missing.");
}

createRoot(root).render(<VessylExperience />);
