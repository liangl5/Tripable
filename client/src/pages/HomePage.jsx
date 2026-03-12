import Navbar from "../components/Navbar.jsx";
import Hero from "../components/Hero.jsx";
import Testimonials from "../components/Testimonials.jsx";
import Features from "../components/Features.jsx";
import Demo from "../components/Demo.jsx";
import CTA from "../components/CTA.jsx";
import Footer from "../components/Footer.jsx";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Testimonials />
        <Features />
        <Demo />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
