import { BarChart, ChordChart, CustomChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

// only the parts the replay's charts draw with, so the rest stays out of the bundle
echarts.use([
  LineChart,
  BarChart,
  ScatterChart,
  CustomChart,
  ChordChart,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  DataZoomComponent,
  AriaComponent,
  CanvasRenderer,
]);

export { echarts };
