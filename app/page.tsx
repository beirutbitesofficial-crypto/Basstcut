import Hero from "@/components/Hero";
import HaircutExperience from "@/components/HaircutExperience";
import About from "@/components/About";
import Services from "@/components/Services";
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
        <Location />
      </main>
      <Footer />
    </>
  );
}
