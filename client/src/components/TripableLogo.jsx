import fullLogoGreen from "../../imgs/logo/full_logo_green.png";
import fullLogoWhite from "../../imgs/logo/full_logo_white.png";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

const sizeClasses = {
  sm: "h-9 max-w-[10rem] sm:h-10 sm:max-w-[12rem]",
  md: "h-10 max-w-[11rem] sm:h-12 sm:max-w-[14rem]",
  lg: "h-11 max-w-[13rem] sm:h-14 sm:max-w-[16rem]"
};

export default function TripableLogo({
  className = "",
  surface = "light",
  size = "md",
  alt = "Tripable logo"
}) {
  const logoSrc = surface === "dark" ? fullLogoWhite : fullLogoGreen;

  return (
    <img
      src={logoSrc}
      alt={alt}
      className={joinClasses("w-auto object-contain", sizeClasses[size] || sizeClasses.md, className)}
    />
  );
}
