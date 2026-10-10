import amazonLogoUrl from "../assets/amazon-logo.png";

type AmazonLogoProps = {
	size?: number;
};

export function AmazonLogo({ size = 18 }: AmazonLogoProps) {
	return (
		<img
			alt=""
			aria-hidden="true"
			className="amazon-logo"
			height={size}
			src={amazonLogoUrl}
			width={size}
		/>
	);
}
