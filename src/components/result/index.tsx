import { Result as AntdResult } from 'antd'
import { FrownFilled, MehFilled, SmileFilled } from '@ant-design/icons'

export enum ResultStatus {
  PERFECT,
  SUCCESS,
  ERROR,
}

interface Props {
  description?: JSX.Element[]
  style?: React.CSSProperties
  result?: ResultStatus
}

const ICON_MAP = {
  [ResultStatus.PERFECT]: <SmileFilled style={{ color: '#a0d911' }} />,
  [ResultStatus.SUCCESS]: <MehFilled style={{ color: '#fa8c16' }} />,
  [ResultStatus.ERROR]: <FrownFilled style={{ color: '#f5222d' }} />,
}

const Result: React.FC<Props> = ({ result = ResultStatus.SUCCESS, style, description }) => {
  const icon = ICON_MAP[result]

  return <>{!!description?.length && <AntdResult style={style} icon={icon} title={description} />}</>
}

export default Result
