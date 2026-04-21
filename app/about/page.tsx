import Link from "next/link"
import { AboutHeaderLeft } from "@/app/about/about-header-left"

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white pb-20">
      <AboutHeaderLeft />

      <section className="mx-auto max-w-3xl px-4 pb-12 pt-20 sm:px-6 lg:px-8">
        <div className="slide-up space-y-8">
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#9a9a9a]">
              About
            </p>
            <h1 className="text-5xl font-light tracking-[-0.05em] text-[#111] sm:text-6xl">
              The Kit Room
            </h1>
          </div>

          <div className="space-y-6 text-[15px] leading-8 text-[#555]">
            <p>
              Football jerseys have crossed over from the pitch into fashion.
              Worn on the street, collected as artifacts, and treated as design
              objects in their own right. Understanding their history matters
              more than ever.
            </p>
            <p>
              The Kit Room is a visualization and directory for exploring some
              of the best kits ever made - a browseable archive built for people
              who care about the craft behind the shirt.
            </p>
            <p>
              Data is sourced primarily from{" "}
              <a
                href="https://www.footballkitarchive.com/"
                target="_blank"
                rel="noreferrer"
                className="font-normal underline decoration-[1px] underline-offset-4"
                style={{ textDecoration: "underline" }}
              >
                footballkitarchive.com
              </a>
              .
            </p>
          </div>

          <Link
            href="/"
            className="text-[13px] text-[#555] underline underline-offset-4"
          >
            Back to collection
          </Link>
        </div>
      </section>
    </main>
  )
}
