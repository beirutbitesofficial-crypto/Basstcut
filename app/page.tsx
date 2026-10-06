import Hero from "@/components/Hero";
import HaircutExperience from "@/components/HaircutExperience";
import About from "@/components/About";
import Services from "@/components/Services";
import Booking from "@/components/Booking";
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
        <Booking />
        <Location />
      </main>
      <Footer />
    </>
  );
}
