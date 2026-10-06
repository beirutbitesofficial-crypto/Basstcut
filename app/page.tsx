import Hero from "@/components/Hero";
import HaircutExperience from "@/components/HaircutExperience";
import About from "@/components/About";
import Services from "@/components/Services";
import BookCta from "@/components/BookCta";
import BookPill from "@/components/BookPill";
import Location from "@/components/Location";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <HaircutExperience />
        <About />
        <Services />
        <BookCta />
        <Location />
      </main>
      <Footer />
      <BookPill />
    </>
  );
}
