import { kicker } from "../lib/ui";

export function PageHeading({ title, subtitle, action }) {
  return (
    <div className="mt-[22px] mb-[15px] flex items-start justify-between gap-2.5 sm:mt-[29px] sm:mb-5 sm:items-center">
      <div>
        <div className={kicker}>PERSONAL FINANCE</div>
        <h1 className="m-0 mb-[5px] font-display text-[19px] font-bold tracking-[-0.7px] sm:text-[22px]">{title}</h1>
        <p className="m-0 max-w-[330px] text-[10px] leading-normal text-muted sm:max-w-none">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
