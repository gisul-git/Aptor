import Error, { type ErrorProps } from "next/error";

export default function CustomError(props: ErrorProps) {
  return <Error statusCode={props.statusCode} title={props.title} />;
}
