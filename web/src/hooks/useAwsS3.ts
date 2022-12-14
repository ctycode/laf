import AWS from "aws-sdk";

import useGlobalStore from "@/pages/globalStore";

function useAwsS3() {
  const currentApp = useGlobalStore((state) => state.currentApp);
  const credentials = currentApp?.oss.credentials!;
  const region = currentApp?.oss.spec.region;

  const s3 = new AWS.S3({
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken,
    endpoint: credentials.endpoint,
    region: region,
    s3ForcePathStyle: true,
    signatureVersion: "v4",
  });

  const getList = async (bucketName: string | undefined, { marker, prefix }: any) => {
    if (!bucketName || bucketName === "") return [];

    const res = await s3
      .listObjects({
        Bucket: bucketName,
        MaxKeys: 100,
        Marker: marker,
        Prefix: prefix,
        Delimiter: "/",
      })
      .promise();
    return res.Contents || [];
  };

  const uploadFile = async (bucketName: string, key: string, body: any, { contentType }: any) => {
    const res = await s3
      .putObject({ Bucket: bucketName, Key: key, ContentType: contentType, Body: body })
      .promise();
    return res;
  };

  return { s3, getList, uploadFile };
}

export default useAwsS3;