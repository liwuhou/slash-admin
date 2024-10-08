import { useState } from 'react';
import { message, Flex } from 'antd';
import UploadBtn, { FileType } from '@/components/upload-btn';
import Result, { ResultStatus } from '@/components/result';
import type { WorkBook, WorkSheet } from 'xlsx';

type OriginData = Map<string, MachinRoom>;
type HandleData = Map<string, MachinRoom>;

type DiffEquipmentData = (
  h: OriginData,
  o: HandleData,
) => { result: ResultStatus; description: JSX.Element[] };
type AnalyzeWorkBook = (h: HandleData, o: OriginData) => ReturnType<DiffEquipmentData>;
type HandleCheckFile = () => boolean;

// 分光器端口状态
enum PortStatus {
  OFF,
  ON,
}

// 分光器端口
interface Port {
  name: string;
  status: PortStatus;
  next: string;
  belongTo: Splitter;
  line: number;
}

// 分光器
interface Splitter {
  name: string;
  belongTo: MachinRoom;
  ports: Map<string, Port>;
}

// 机房
interface MachinRoom {
  name: string;
  major?: string;
  splitters: Map<string, Splitter>;
}

// const formatEquipmentSheetData = (s: WorkSheet) => {
//   const map = new Map<string, MachinRoom>()
//   const maxLength = parseInt(s['!ref']?.split(':')?.[1]?.replace?.(/[a-z]/gi, '') ?? '0', 10)

//   for (let i = 2; i <= maxLength; i++) {
//     // TODO:
//   }
// }

const formatPortSheetData = (
  s: WorkSheet,
  columns: [string, string, string, string, string],
  initRow = 3,
): Map<string, MachinRoom> => {
  const [a, b, c, d, e] = columns;
  const map = new Map<string, MachinRoom>();
  const maxLength = parseInt(s['!ref']?.split(':')?.[1]?.replace?.(/[a-z]/gi, '') ?? '0', 10);

  if (maxLength <= initRow) return map;

  for (let i = initRow; i <= maxLength; i++) {
    const cell = `${a}${i}`;
    const roomName = Reflect.get(s, cell)?.v ?? '';

    if (roomName) {
      if (!map.has(roomName)) {
        map.set(roomName, { name: roomName, splitters: new Map() as MachinRoom['splitters'] });
      }
      const machinRoom = map.get(roomName)!;
      const { splitters } = machinRoom;

      const splitterName = Reflect.get(s, `${b}${i}`)?.v ?? '';

      if (splitterName) {
        if (!splitters.has(splitterName)) {
          splitters.set(splitterName, {
            name: splitterName,
            belongTo: machinRoom,
            ports: new Map() as Splitter['ports'],
          });
        }
        const splitter = splitters.get(splitterName)!;
        const { ports } = splitter;

        const portName = Reflect.get(s, `${c}${i}`)?.v ?? '';

        if (portName) {
          if (!ports.has(portName)) {
            const line = i;
            const next = Reflect.get(s, `${d}${i}`)?.v?.trim() || '';
            const status =
              Reflect.get(s, `${e}${i}`)?.v?.trim() === '空闲' ? PortStatus.OFF : PortStatus.ON;
            ports.set(portName, { name: portName, belongTo: splitter, status, next, line });
          }
        }
      }
    }
  }

  return map;
};

const countSplitterPorts = (
  handleSplitters: Map<string, Splitter>,
  originSplitters: Map<string, Splitter>,
) => {
  let [on, off, all, right, wrong, error] = [0, 0, 0, 0, 0, [] as string[]];

  for (const [key, handleSplitter] of handleSplitters) {
    all += handleSplitter.ports.size;
    const originSplitter = originSplitters.get(key);
    if (handleSplitter.name !== originSplitter?.name) {
      wrong += handleSplitter.ports.size;
      continue;
    }

    for (const [key, handlePort] of handleSplitter.ports) {
      const originPort = originSplitter.ports.get(key);
      const currentLine = handlePort.line;
      if (handlePort.status === PortStatus.ON) {
        on++;
      } else {
        off++;
      }
      if (handlePort.name !== originPort?.name) {
        wrong++;
        error.push(`第 ${currentLine} 行，端口名称错误`);
        continue;
      }
      if (handlePort.status !== originPort?.status) {
        wrong++;
        error.push(`第 ${currentLine} 行，端口占用状态错误`);
        continue;
      }
      if (handlePort.next !== originPort?.next) {
        wrong++;
        error.push(`第 ${currentLine} 行，端口下一跳设备错误`);
        continue;
      }
      right++;
    }
  }

  return {
    on,
    off,
    all,
    right,
    wrong,
    error,
  };
};

const diffPortData: DiffEquipmentData = (handleData, originData) => {
  let result = ResultStatus.SUCCESS;
  const description = [];

  for (const [key, handleMachineRoom] of handleData) {
    const originMachineRoom = originData.get(key);
    if (!originMachineRoom) {
      description.push(
        <div>
          <b>{handleMachineRoom.name}</b>录入有误！
        </div>,
      );
      break;
    }

    const machiRoomName = handleMachineRoom.name;
    const splitterCount = handleMachineRoom.splitters.size;
    const { on, off, all, right, wrong, error } = countSplitterPorts(
      handleMachineRoom.splitters,
      originMachineRoom.splitters,
    );
    // FIXME: 多个机房时要综合一下
    if (right === all) {
      result = ResultStatus.PERFECT;
    } else if (wrong > right) {
      result = ResultStatus.ERROR;
    } else {
      result = ResultStatus.SUCCESS;
    }

    description.push(
      <div>
        <b>{machiRoomName}</b>合计{splitterCount}台分光器，合计<b>{all}</b>个端口，其中<b>{on}</b>
        个在用端口，<b>{off}</b>个空闲端口
        <div>
          匹配系统录入数据，其中录入准确<b>{right}</b>个端口，录入有误<b>{wrong}</b>个端口。
        </div>
        {error.length > 0 && error.map((e) => <div>{e}</div>)}
      </div>,
    );
  }

  return {
    description,
    result,
  };
};

/**
 *测试表格-设备端口：
  1、原始表格-链路的sheet是要核对的，导出表就是从系统上导出来和原数据端口进行核对；
  2、“原始表格-链路”的A和B列做一下统计，即：XX机房XX专业XX条链路；
  3、“原数据端口”的J&K列和“导出表”的A&B列是匹配条件，“原数据端口”的L列和M列对应“导出表”的D列是匹配结果；
  4、针对原数据端口表输出报告模板如下：

  descriptipon:
    XXX机房（C列）XX专业合计XX条链路（第二点有描述），匹配系统录入数据，其中录入准确XX个链路（第三点的匹配结果），录入有误XX个链路（第三点的匹配结果）。 
 */
// const analyzeEquipmentData: AnalyzeWorkBook = (workbook) => {
//   const [handleKey, originKey] = workbook.SheetNames
//   const handleSheet = workbook.Sheets[handleKey]
//   const originSheet = workbook.Sheets[originKey]

//   const handleData = formatEquipmentSheetData(handleSheet, ['C', 'E', 'F', 'H', 'G'])
//   const originData = formatEquipmentSheetData(originSheet, ['A', 'B', 'C', 'E', 'N'], 2)
// }

/**
 * 测试表格-设备端口：
  1、原数据端口的sheet是要核对的，导出表就是从系统上导出来和原数据端口进行核对；
  2、“原数据端口”的C列和“导出表”的A列核对机房是否一致；
  3、“原数据端口”的E&F列和“导出表”的B&C列是匹配条件，“原数据端口”的H列对应“导出表”的E列是匹配结果；
  4、针对原数据端口表输出报告模板如下：

  description:
    XXX机房（C列）合计XX台分光器（看能不能针对E列去重后统计数量，不能就后面人工写入就可以了）
    合计XX个端口（直接统计数据的行数就可以了），
    其中在用XX个端口（G列统计）、空闲端口XX个（G列）；
    匹配系统录入数据，其中录入准确XX个端口（第三点的匹配结果），录入有误XX个端口（第三点的匹配结果）。
 */
const analyzePortData: AnalyzeWorkBook = (
  handleData: Map<string, MachinRoom>,
  originData: Map<string, MachinRoom>,
) => {
  return diffPortData(handleData, originData);
};

const formatFileData = (type: FileType, workBook: WorkBook) => {
  const [key] = workBook.SheetNames;
  const sheet = workBook.Sheets[key];
  return type === FileType.HANDLE
    ? formatPortSheetData(sheet, ['C', 'E', 'F', 'H', 'G'])
    : formatPortSheetData(sheet, ['A', 'B', 'C', 'E', 'N'], 2);
};

function App() {
  const [handleData, setHandleData] = useState<HandleData | null>(null);
  const [originData, setOriginData] = useState<OriginData | null>(null);
  const [description, setDescription] = useState<JSX.Element[]>([]);
  const [result, setResult] = useState<ResultStatus>(ResultStatus.PERFECT);

  const handleReset = () => {
    setHandleData(null);
    setOriginData(null);
    setDescription([]);
    setResult(ResultStatus.ERROR);
  };

  const handleCheckFile: HandleCheckFile = () => {
    if (!handleData) {
      message.error('请上传“原始台账文件”');
      return false;
    }
    if (!originData) {
      message.error('请上传“资源系统导出文件”');
      return false;
    }

    if (!handleData?.size) {
      message.error('上传的原端口数据表数据异常，请检查');
      console.error('上传了空表');
      return false;
    }

    return true;
  };

  const handleConfirm = () => {
    if (!handleCheckFile()) return;

    const { description, result } = analyzePortData(handleData!, originData!);
    setDescription(description);
    setResult(result);
  };

  const handleFileUpload = (type: FileType, workbook: WorkBook) => {
    const data = formatFileData(type, workbook);
    if (type === FileType.HANDLE) {
      setHandleData(data);
    } else {
      setOriginData(data);
    }
  };

  return (
    <>
      <Flex gap="middle">
        <UploadBtn
          onUpload={handleFileUpload}
          onReset={handleReset}
          onConfirm={handleConfirm}
          label={[
            { label: '原始台账文件', link: '' },
            { label: '资源系统导出文件', link: '' },
          ]}
        />
        <Result style={{ width: '100%' }} result={result} description={description} />
      </Flex>
    </>
  );
}

export default App;
