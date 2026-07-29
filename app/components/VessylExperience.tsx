"use client";

import { useEffect, useState, type MouseEvent } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";

const DomeScene = dynamic(
  () => import("./DomeScene").then((module) => module.DomeScene),
  { ssr: false },
);

const BOOKING_URL =
  "https://be.synxis.com/?adult=1&chain=27398&child=0&currency=CRC&hotel=99564&level=hotel&locale=en-US&productcurrency=CRC&rooms=1";
const MOBILE_SCROLL_LOCK_CLASS = "mobile-scroll-locked";
const TEXT_ARROWS = {
  external: "\u2197\uFE0E",
  down: "\u2193\uFE0E",
} as const;

const chapters = [
  { id: "top", label: "Arrival" },
  { id: "dome", label: "The Dome" },
  { id: "experience", label: "Experience" },
  { id: "arenal", label: "Arenal" },
  { id: "stay", label: "Stay" },
  { id: "book", label: "Book" },
];

const stages = [
  {
    number: "01",
    title: "Arrive",
    body: "The room quiets. Breath and attention begin to slow.",
  },
  {
    number: "02",
    title: "Descend",
    body: "Sound and floor-borne vibration move awareness inward.",
  },
  {
    number: "03",
    title: "Expand",
    body: "Light, space, and sensory detail widen the field.",
  },
  {
    number: "04",
    title: "Return",
    body: "The experience resolves back into presence—grounded and awake.",
  },
];

function Arrow() {
  return (
    <span className="text-arrow" aria-hidden="true">
      {TEXT_ARROWS.external}
    </span>
  );
}

export function VessylExperience() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    const elements = chapters
      .map(({ id }) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = elements.indexOf(entry.target as HTMLElement);
          if (index >= 0) setActiveChapter(index);
          entry.target.classList.add("is-visible");
        });
      },
      { rootMargin: "-28% 0px -54% 0px", threshold: 0.04 },
    );

    elements.forEach((element) => observer.observe(element));

    let progressFrame = 0;
    let pointerFrame = 0;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const commitProgress = () => {
      progressFrame = 0;
      const max = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const pageProgress = Math.min(1, Math.max(0, window.scrollY / max));
      root.style.setProperty(
        "--page-progress",
        String(pageProgress),
      );
    };

    const updateProgress = () => {
      if (progressFrame) return;
      progressFrame = window.requestAnimationFrame(commitProgress);
    };

    const updatePointer = (event: PointerEvent) => {
      if (!finePointer.matches || reducedMotion.matches) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (pointerFrame) return;
      pointerFrame = window.requestAnimationFrame(() => {
        pointerFrame = 0;
        root.style.setProperty("--pointer-x", `${pointerX}px`);
        root.style.setProperty("--pointer-y", `${pointerY}px`);
      });
    };

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("pointermove", updatePointer, { passive: true });
    commitProgress();

    const revealTimer = window.setTimeout(() => {
      root.classList.add("experience-ready");
    }, 120);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(progressFrame);
      window.cancelAnimationFrame(pointerFrame);
      window.clearTimeout(revealTimer);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("pointermove", updatePointer);
      root.classList.remove("experience-ready");
      root.style.removeProperty("--page-progress");
      root.style.removeProperty("--pointer-x");
      root.style.removeProperty("--pointer-y");
    };
  }, []);

  useEffect(() => {
    const releaseScrollLock = () => {
      document.body.classList.remove(MOBILE_SCROLL_LOCK_CLASS);
    };

    if (!menuOpen) {
      releaseScrollLock();
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.body.classList.add(MOBILE_SCROLL_LOCK_CLASS);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      releaseScrollLock();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const navigateToChapter = (
    event: MouseEvent<HTMLAnchorElement>,
    chapterId: string,
  ) => {
    event.preventDefault();
    event.currentTarget.blur();

    document.body.classList.remove(MOBILE_SCROLL_LOCK_CLASS);
    setMenuOpen(false);

    const target = document.getElementById(chapterId);
    if (!target) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const behavior = reducedMotion ? "auto" : "smooth";
    const hash = `#${chapterId}`;

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior, block: "start" });
      if (window.location.hash === hash) {
        window.history.replaceState(null, "", hash);
      } else {
        window.history.pushState(null, "", hash);
      }
    });
  };

  return (
    <div className="experience">
      <div className="scene-shell" aria-hidden="true">
        <DomeScene />
        <div className="scene-fallback" />
        <div className="scene-atmosphere" />
        <div className="scene-vignette" />
      </div>
      <div className="ambient-field" aria-hidden="true" />

      <header className="site-header">
        <a
          className="brand"
          href="#top"
          aria-label="The Vessyl home"
          onClick={(event) => navigateToChapter(event, "top")}
        >
          <Image
            src="/vessyl-logo.svg"
            alt="The Vessyl"
            width={4212}
            height={1320}
            priority
            unoptimized
          />
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {chapters.slice(1, 5).map((chapter) => (
            <a
              key={chapter.id}
              href={`#${chapter.id}`}
              onClick={(event) => navigateToChapter(event, chapter.id)}
            >
              {chapter.label}
            </a>
          ))}
        </nav>

        <a
          className="header-book"
          href={BOOKING_URL}
          target="_blank"
          rel="noreferrer"
        >
          Book your stay
          <Arrow />
        </a>

        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
      </header>

      <div
        className={`mobile-menu${menuOpen ? " is-open" : ""}`}
        id="mobile-navigation"
        aria-hidden={!menuOpen}
      >
        <div className="mobile-menu-inner">
          {chapters.slice(1).map((chapter, index) => (
            <a
              key={chapter.id}
              href={`#${chapter.id}`}
              onClick={(event) => navigateToChapter(event, chapter.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {chapter.label}
            </a>
          ))}
          <a
            className="mobile-book"
            href={BOOKING_URL}
            target="_blank"
            rel="noreferrer"
            onClick={closeMenu}
          >
            Book your stay
            <Arrow />
          </a>
        </div>
      </div>

      <aside className="chapter-rail" aria-label="Page chapters">
        <span className="rail-progress" aria-hidden="true" />
        {chapters.map((chapter, index) => (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            className={activeChapter === index ? "is-active" : ""}
            aria-label={`Go to ${chapter.label}`}
            onClick={(event) => navigateToChapter(event, chapter.id)}
          >
            <span>{String(index).padStart(2, "0")}</span>
            <i />
          </a>
        ))}
      </aside>

      <main>
        <section className="chapter hero" id="top" data-chapter="0">
          <div className="chapter-inner hero-inner">
            <div className="hero-copy reveal">
              <p className="eyebrow">
                <span>The Vessyl Resort</span>
                <span>Arenal · Costa Rica</span>
              </p>
              <h1>
                Not a Vacation.
                <em>A Recalibration.</em>
              </h1>
              <p className="hero-lead">
                An immersive wellness resort where nature, sound, vibration,
                and light create the conditions for deep restoration and
                expanded awareness.
              </p>
              <div className="hero-actions">
                <a
                  className="button button-primary"
                  href="#dome"
                  onClick={(event) => navigateToChapter(event, "dome")}
                >
                  Enter The Dome
                  <span className="text-arrow" aria-hidden="true">
                    {TEXT_ARROWS.down}
                  </span>
                </a>
                <a
                  className="text-link"
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Book your stay
                  <Arrow />
                </a>
              </div>
            </div>

            <div className="hero-notation reveal" aria-hidden="true">
              <div>
                <span>10.5321° N</span>
                <span>84.6650° W</span>
              </div>
              <p>
                THE DOME
                <small>Sensory architecture · 01</small>
              </p>
            </div>

            <a
              className="scroll-cue"
              href="#dome"
              onClick={(event) => navigateToChapter(event, "dome")}
            >
              <span>Scroll to enter</span>
              <i aria-hidden="true" />
            </a>
          </div>
        </section>

        <section className="chapter chapter-dome" id="dome" data-chapter="1">
          <div className="chapter-inner align-right">
            <div className="section-copy reveal">
              <p className="section-index">
                01
                <span>Patented technology</span>
              </p>
              <h2>
                Feel sound
                <em>become space.</em>
              </h2>
              <p className="section-lead">
                Inside The Dome, spatial sound moves through the room while
                vibration travels through the floor. Light and digital layers
                complete a full-body environment—not something you watch, but
                something you enter.
              </p>
            </div>

            <div className="signal-grid reveal">
              <article>
                <span>01 / SOUND</span>
                <h3>Spatial audio</h3>
                <p>Sound arrives from every direction.</p>
              </article>
              <article>
                <span>02 / TOUCH</span>
                <h3>Vibrotactile floor</h3>
                <p>Low frequencies become physical.</p>
              </article>
              <article>
                <span>03 / LIGHT</span>
                <h3>Immersive projection</h3>
                <p>The ceiling opens into motion and color.</p>
              </article>
            </div>
          </div>
        </section>

        <section
          className="chapter chapter-experience"
          id="experience"
          data-chapter="2"
        >
          <div className="chapter-inner">
            <div className="journey-heading reveal">
              <p className="section-index">
                02
                <span>A guided experiential arc</span>
              </p>
              <h2>
                From your heartbeat
                <em>to the horizon.</em>
              </h2>
              <p>
                Curated programs use sensory contrast to shift attention:
                inward, outward, and finally home again. Every layer supports
                the same simple intention—to make more room for presence.
              </p>
            </div>

            <div className="journey-path reveal">
              {stages.map((stage) => (
                <article key={stage.number}>
                  <span>{stage.number}</span>
                  <i aria-hidden="true" />
                  <h3>{stage.title}</h3>
                  <p>{stage.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="chapter chapter-place" id="arenal" data-chapter="3">
          <div className="chapter-inner media-layout">
            <div className="section-copy reveal">
              <p className="section-index">
                03
                <span>The environment</span>
              </p>
              <h2>
                Arenal is not
                <em>the backdrop.</em>
              </h2>
              <p className="section-lead">
                Rainforest, volcanic terrain, open sky, and the changing
                weather become part of the experience. The Vessyl is designed
                with the landscape—not simply placed inside it.
              </p>
              <p className="detail-note">
                Monterrey, San Carlos
                <span>At the foot of Arenal Volcano</span>
              </p>
            </div>

            <figure className="photo-portal portal-arenal reveal">
              <picture>
                <source
                  media="(max-width: 820px)"
                  srcSet="/media/arenal-mobile.webp"
                />
                <Image
                  src="/media/arenal.webp"
                  alt="Arenal Volcano seen from the rainforest near The Vessyl"
                  fill
                  sizes="(max-width: 820px) calc(100vw - 40px), 58vw"
                  unoptimized
                />
              </picture>
              <figcaption>
                <span>Landscape / 10.5321° N</span>
                <span>Natural calibration</span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="chapter chapter-stay" id="stay" data-chapter="4">
          <div className="chapter-inner media-layout media-layout-reverse">
            <figure className="photo-portal portal-stay reveal">
              <picture>
                <source
                  media="(max-width: 820px)"
                  srcSet="/media/stay-mobile.webp"
                />
                <Image
                  src="/media/stay.webp"
                  alt="Pool terrace and mountain view at The Vessyl"
                  fill
                  sizes="(max-width: 820px) calc(100vw - 40px), 58vw"
                  unoptimized
                />
              </picture>
              <figcaption>
                <span>Pool terrace / Arenal</span>
                <span>Rest between sessions</span>
              </figcaption>
            </figure>

            <div className="section-copy reveal">
              <p className="section-index">
                04
                <span>Stay with us</span>
              </p>
              <h2>
                Rest is part of
                <em>the program.</em>
              </h2>
              <p className="section-lead">
                Private suites offer quiet comfort between sessions, with
                premium linens, individual temperature control, considered
                simplicity, and modern essentials. A quiet place to let the
                experience settle.
              </p>
              <a
                className="text-link"
                href={BOOKING_URL}
                target="_blank"
                rel="noreferrer"
              >
                Explore availability
                <Arrow />
              </a>
            </div>
          </div>
        </section>

        <section className="chapter chapter-book" id="book" data-chapter="5">
          <div className="chapter-inner book-inner">
            <div className="book-copy reveal">
              <p className="section-index centered">
                Now open
                <span>Arenal · Costa Rica</span>
              </p>
              <h2>
                Come for The Dome.
                <em>Leave with more space.</em>
              </h2>
              <p>
                The Vessyl is welcoming a limited number of guests. Choose your
                dates and begin the experience.
              </p>
              <a
                className="button button-primary button-large"
                href={BOOKING_URL}
                target="_blank"
                rel="noreferrer"
              >
                Book The Vessyl
                <Arrow />
              </a>
            </div>

            <div className="booking-meta reveal">
              <a
                href="https://maps.app.goo.gl/GTt3NqpiWCWDYpPJ8"
                target="_blank"
                rel="noreferrer"
              >
                Get directions
                <Arrow />
              </a>
              <a href="mailto:info@thevessyl.com">
                info@thevessyl.com
                <Arrow />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <Image
          src="/footer-mark.svg"
          alt=""
          aria-hidden="true"
          width={230}
          height={230}
          unoptimized
        />
        <p>
          The Vessyl
          <span>Arenal, Costa Rica</span>
        </p>
        <p className="footer-note">
          Nature · Sound · Vibration · Awareness
          <span>© {new Date().getFullYear()} The Vessyl</span>
        </p>
      </footer>
    </div>
  );
}
