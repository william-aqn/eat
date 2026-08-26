// Футер как на блоге x-crm.in; ссылки ведут на страницы блога
import { BLOG_URL } from "../links";

const FOUNDED_YEAR = 2005;

export default function Footer() {
  return (
    <footer className="site-footer">
      <p>
        <a href={BLOG_URL}>DCRM</a> © {FOUNDED_YEAR}–{new Date().getFullYear()} |{" "}
        <a href={`${BLOG_URL}/disclaimer.html`}>Disclaimer</a> |{" "}
        <a href={`${BLOG_URL}/copyright.html`}>Copyright</a> |{" "}
        <a href={`${BLOG_URL}/donation.html`}>Donation</a>
      </p>
    </footer>
  );
}
