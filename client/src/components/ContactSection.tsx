import { ArrowUpRight, Mail, MapPin, Phone, Utensils } from "lucide-react";
import "./ContactSection.css";

export default function ContactSection({ name, email, phone, address, home }: { name: string; email?: string; phone?: string; address?: string; home: string }) {
  const gmail = email ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(`Hello ${name}`)}` : "";
  const whatsapp = phone ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello ${name}`)}` : "";
  return <>
    <section className="contact-section" id="contact">
      <div className="contact-intro"><p className="section-kicker">WE WOULD LOVE TO HEAR FROM YOU</p><h2>Let’s keep<br /><em>in touch.</em></h2><p>Questions about a dish, your order, or a table? Reach out and our team will help.</p></div>
      <div className="contact-options">
        {email && <a className="contact-option" href={gmail} target="_blank" rel="noreferrer"><span className="contact-icon"><Mail size={19} /></span><span><small>EMAIL US</small><b>{email}</b><i>Open in Gmail</i></span><ArrowUpRight size={17} /></a>}
        {phone && <a className="contact-option" href={whatsapp} target="_blank" rel="noreferrer"><span className="contact-icon"><Phone size={19} /></span><span><small>WHATSAPP</small><b>{phone}</b><i>Chat with our team</i></span><ArrowUpRight size={17} /></a>}
        {address && <div className="contact-option contact-address"><span className="contact-icon"><MapPin size={19} /></span><span><small>FIND US</small><b>{address}</b><i>Visit us during opening hours</i></span></div>}
        {!email && !phone && !address && <div className="contact-option"><span className="contact-icon"><Mail size={19} /></span><span><small>CONTACT</small><b>Contact details are not set yet.</b><i>Restaurant owner can add them in restaurant settings.</i></span></div>}
      </div>
    </section>
    <footer className="site-footer"><a className="brand footer-brand" href={`${home}#top`}><span className="brand-mark"><Utensils size={18} /></span><span className="brand-name">{name}<small>RESTAURANT & KITCHEN</small></span></a><span>© 2026 {name}</span><a className="footer-contact-link" href="#contact">Contact us <ArrowUpRight size={13} /></a></footer>
  </>;
}
