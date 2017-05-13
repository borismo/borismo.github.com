let fit = function () {
  'use strict';

  let interval,//Rp,
    Irp = []/*,
    nonLinCurr = [],
    shuntCurrent = [],
    fileData = {
      nonLinCurr = [],
      shuntCurrent = [],
    }*/;

  function estimRp(dataArray) {
    // Estimate parallel resistance Rp
    let min = +Infinity,
      array = dataArray[0];

    for (let xy of array) {
      let x = xy[0],
        slope = xy[1] / x;
      if (slope < min && Math.abs(x) > 0.001) {
        min = slope;
      }
    }

    let Rp = 1 / min;
    // var oOM = orderOfMagn(Rp);
    //var roundedRp = Math.round(Rp * 1000 / oOM) * oOM / 1000;

    return Rp;
  }

  function calcIrpAndNonLinRevCurr(dataArray, Rp) {
    let array = dataArray[0],
      nonLinDirCurr = [],
      shuntCurrent = [],
      nonLinCurr = [];

    for (let VI of array) {
      let V = VI[0],
        Irp = V / Rp;
      shuntCurrent.push([V, Irp]);

      if (V < -0.0001) {
        // Only looking at reverse polarization:
        // Non-linear reverse current is total current minus parallel current (which is linear)
        let Inl = VI[1] - Irp; // Inl -> 'nl' = 'Non-Linear'

        // Deduce direct non linear current
        nonLinDirCurr.unshift([-V, -Inl]);

        // Reverse
        nonLinCurr.push([V, Inl]);
      }
    }

    // Combine reverse and direct
    nonLinCurr = nonLinCurr.concat([[0, 0]], nonLinDirCurr);

    return {
      shunt: shuntCurrent,
      nonLinear: nonLinCurr
    }
  }

  function toggleIrp(modifDataArray, shuntCurrent, show) {
    // Show or hide Irp on graph

    let array = modifDataArray[0],
      newArray = [],
      i = 0,
      sign = (show) ? 1 : -1;

    for (let IV of array) {
      newArray.push([IV[0], IV[1] + sign * shuntCurrent[i][1]]);
      i++;
    }

    modifDataArray = [newArray];

    if (plot) {
      main.combDataAndCalc();
    }
    return modifDataArray;
  }

  function toggleNonLinCurr(userData, modifDataArray, show) {

    const nonLinearCurrent =  userData.current.nonLinear;

    var array1 = userData.dataArray[0],
      array2 = userData.modifDataArray[0],
      IV1, IV2,
      newArray1 = [],
      newArray2 = [],
      sign = (show) ? 1 : -1,
      i = 0;
      
    for (let IV1 of array1) {
      newArray1.push([IV1[0], IV1[1] + sign * nonLinearCurrent[i][1]]);
      IV2 = array2[i];
      newArray2.push([IV2[0], IV2[1] + sign * nonLinearCurrent[i][1]]);
      i++;
    }

    return {
      dataArray: [newArray1],
      modifDataArray: [newArray2]
    }
  }

  let SqResSum,
    prevSqResSum = undefined,
    dS,
    delS = [];

  function calcSqResSum(params, dataArray, arrayCalc) {
    // Calculates the sum of squared residuals
    const k = main.k,
      q = main.q,
      paramValues = params.value;

    let n1 = paramValues.n1,
      Is1 = paramValues.is1,
      Rp = paramValues.rp1,
      Rs = paramValues.rs,
      T = paramValues.t,
      single = document.getElementById('singleDiode').checked;

    SqResSum = 0;

    if (single) {
      // Single diode model
      var Is2 = 0,
        n2 = 1;
    } else {
      // Dual diode model
      var Is2 = paramValues.is2,
        n2 = paramValues.n2;
    }

    if (document.getElementById('series').checked) {
      // Dual, series diode model
      let Rp2 = paramValues.rp2;
      n1 = paramValues.n1;
    }

    var r, calcI, j = 1, x1, x2, xy1, xy2, y1, y2, slope, x,
      calcIV = arrayCalc[0],
      array = dataArray[0],
      stringArray = '',
      data,
      dSdn1 = 0,
      dSdn2 = 0,
      dSdIs1 = 0,
      dSdIs2 = 0,
      dSdRp = 0,
      dSdRs = 0;
    //d2Sdn2 = 0;
    var A = Is1 * q / (k * T),
      dIdn1, dIdn2, dIdIs1, dIdIs2, dIdRp, dIdRs, exp1, exp2;

    for (var i = 0; i < array.length; i++) {
      //for each data point
      x = array[i][0];

      while (x > calcIV[j][0]) { j++; }
      xy1 = calcIV[j - 1];
      xy2 = calcIV[j];
      x1 = xy1[0];
      x2 = xy2[0];
      y1 = xy1[1];
      y2 = xy2[1];
      data = array[i][1];

      //linear interpolation
      slope = (y2 - y1) / (x2 - x1);
      calcI = y1 + slope * (x - x1);

      r = (calcI - data) / Math.abs(data);

      if (isFinite(r)) {
        exp1 = Math.exp(q * (x - Rs * calcI) / (n1 * k * T));
        exp2 = Math.exp(q * (x - Rs * calcI) / (n2 * k * T));

        dIdn1 = q * (Rs * calcI - x) / (Math.pow(n1, 2) * k * T * (1 + Rs / Rp + q * Is2 * Rs * exp2 / (n2 * k * T)) / (Is1 * exp1) + n1 * Rs * q);
        dSdn1 += 2 * r * dIdn1 / Math.abs(data);

        dIdn2 = q * (Rs * calcI - x) / (Math.pow(n2, 2) * k * T * (1 + Rs / Rp + q * Is1 * Rs * exp1 / (n1 * k * T)) / (Is2 * exp2) + n2 * Rs * q);
        dSdn2 += 2 * r * dIdn2 / Math.abs(data);

        dIdIs1 = (exp1 - 1) / (1 + q * Is1 * Rs * exp1 / (n1 * k * T) + q * Is2 * Rs * exp2 / (n2 * k * T) + Rs / Rp);
        //dIdIs1 = (exp1 - 1) / (1 + q * Is1 * Rs * exp1 / (n1 * k * T) + Rs / Rp);
        dSdIs1 += 2 * r * dIdIs1 / Math.abs(data);

        dIdIs2 = (exp2 - 1) / (1 + q * Is1 * Rs * exp1 / (n1 * k * T) + q * Is2 * Rs * exp2 / (n2 * k * T) + Rs / Rp);
        dSdIs2 += 2 * r * dIdIs2 / Math.abs(data);

        dIdRp = (calcI * Rs - x) / (Math.pow(Rp, 2) * (1 + q * Is1 * Rs * exp1 / (n1 * k * T) + q * Is2 * Rs * exp2 / (n2 * k * T) + Rs / Rp));
        dSdRp += 2 * r * dIdRp / Math.abs(data);

        dIdRs = - calcI * (q * Is1 * exp1 / (n1 * k * T) + q * Is2 * exp2 / (n2 * k * T) + 1 / Rp) / (1 + Rs * (q * Is1 * exp1 / (n1 * k * T) + q * Is2 * exp2 / (n2 * k * T) + 1 / Rp));
        //dIdRs = - calcI * (q * Is1 * exp1 / (n1 * k * T) + 1 / Rp) / (1 + Rs * (q * Is1 * exp1 / (n1 * k * T) + 1 / Rp));
        dSdRs += 2 * r * dIdRs / Math.abs(data);

        SqResSum += Math.pow(r, 2);
      }
      delS = [dSdn1, dSdIs1, dSdRp, dSdRs];
      if (!single) {
        delS.splice(1, 0, dSdn2);
        delS.splice(3, 0, dSdIs2);
      }
    }

    // Display residue
    $('#s').text(SqResSum.toExponential(2));

    prevSqResSum = SqResSum;

    return SqResSum;
  }

  function deriv(array) {
    var der, prev, next, derArray = [], stringArray = 'V\tln(I)\td[ln(I)]/dV';
    for (var i = 1; i < array.length - 1; i++) {//Derivative not calculated for 1st and last point
      prev = array[i - 1];
      next = array[i + 1];
      der = (next[1] - prev[1]) / (next[0] - prev[0]);
      derArray.push([array[i][0], der]);
      stringArray = stringArray.concat('\n' + array[i][0] + '\t' + array[i][1] + '\t' + der);
    }
    return derArray;
  }

  function lnOfArray(array) {
    var xy, y, newArray = [];
    for (var i = 0; i < array.length; i++) {
      xy = array[i];
      y = xy[1];
      if (y != 0) {
        newArray.push([xy[0], Math.log(Math.abs(y))]);
      }
    }

    return newArray;
  }

  function findDiodes(userData, IprShowed, nonLinearCurrentShowed) {
    let modifDataArray = userData.modifDataArray,
      shuntCurrent = userData.current.shunt,
      plot = false;

    if (IprShowed) {
      modifDataArray = toggleIrp(modifDataArray, shuntCurrent, plot, false);
    } // diode parameters better evaluated when Rp = infinity

    if (nonLinearCurrentShowed) {
      let result = toggleNonLinCurr(userData, modifDataArray, false);
      modifDataArray = result.modifDataArray;
    }

    let noIrpNoSCLCarray = modifDataArray[0],
      array = modifDataArray[0];

    let array1 = deriv(lnOfArray(array));// 1st order derivative

    array = deriv(array1);//2nd order derivative

    let i = array.length - 2,
      prev,
      dLn = array[i][1],
      dLnMin = 0,
      deltaLnMax = 0,
      j = 0;

    var avDelta = function (array) {
      var sum = 0,
        length = array.length;
      for (var i = 1; i < length; i++) {
        sum += Math.abs(array[i][1] - array[i - 1][1]);
      }
      return sum / (length - 1);
    }
    var avD = avDelta(array);

    var iMin = i,
      fluctIn2ndHalf = false;
    do {
      i = iMin;
      dLn = array[i][1];
      var maxPassed = false;
      do {// looking for minima between 0.04 V and Vmax
        i--;
        prev = dLn;
        dLn = array[i][1];

        fluctIn2ndHalf += Math.abs(dLn - prev) > avD && i < array.length / 2;
        maxPassed += prev > dLn && Math.abs(dLn - prev) < avD;
        var carryOn = !maxPassed || dLn < prev;
      } while (i >= 0 && array[i][0] > 0.04 && carryOn && !fluctIn2ndHalf)
      iMin = i + 1;
      dLnMin = prev;

      var dLnMax = dLnMin;
      prev = -Infinity;
      i = iMin - 1;
      var iMax = iMin;
      while (i >= 0 && array[i][0] > 0.04) {// looking for a maxima between 0.04 V and Vmax
        dLn = array[i][1];

        if (dLn < prev && prev > dLnMax && Math.abs(dLn - prev) < avD) {
          iMax = i;
          dLnMax = prev;
        }
        prev = dLn;
        i--;
      }

      if (dLnMax - dLnMin > deltaLnMax) {
        deltaLnMax = dLnMax - dLnMin;
        var iMaxMax = iMax;
      }
      j++;
    } while (iMax != iMin && j < 10 && !fluctIn2ndHalf)

    if (!iMaxMax) { return 'noDiode'; }

    i = iMax = iMaxMax;
    dLn = array[i][1];
    do {
      prev = dLn;
      i--;
      dLn = array[i][1];
    } while (Math.abs(dLn) < Math.abs(prev) || dLn >= 0)
    var iD1 = i + 2;
    var D1dLn = array1[iD1 + 1][1];

    i = iMax;
    do {
      prev = dLn;
      i++;
      dLn = array[i][1];
    } while (Math.abs(dLn) < Math.abs(prev) || dLn >= 0)
    var iD2 = i - 1;
    var D2dLn = array1[iD2 + 1][1];

    var length = array.length - 2;

    iD2 = length - iD2;
    iD1 = length - iD1;
    /* iD2 (and iD1) are the indexes of the maxima (and minima), starting from the *end* of the original array,
    in case points in reverse are missing after removal of Irp and SCLC */
    
    return {
      noIrpNoSCLCarray: noIrpNoSCLCarray,
      diodes: [D2dLn, D1dLn, iD2, iD1]
    };
  }

  function estimD1D2Rs(params, userData, findDiodesResult) {
    if (document.getElementById('series').checked) {
      // For now, no estimation for series model
      return;
    }
    
    const paramValues = params.value,
      paramChecked = params.checked;

    let maxmin = findDiodesResult.diodes;

    if (maxmin === 'noDiode') {
      // TODO: Display message
      return;
    }
    
    let dualDiode = !document.getElementById('singleDiode').checked,
      array = findDiodesResult.noIrpNoSCLCarray,
      
      D1dLn = maxmin[1],
      D2dLn = maxmin[0],
      VIAtd1 = array[array.length - 4 - maxmin[3]],
      VIAtd2 = array[array.length - 4 - maxmin[2]],
      T = paramValues.t,
      A = main.q / (main.k * T),
      n2 = A / D2dLn;

    if (dualDiode) {
      if (paramChecked.n2) {
        var n = n2,
          n2Fixed = '';
      } else {
        var n = n2 = paramValues.n2,
          n2Fixed = ' <span style="color:grey">(fixed)</span>';
      }
      if (paramChecked.n1) {
        var n1 = A / D1dLn,
          n1Fixed = '';
      } else {
        var n1 = paramValues.n1,
          n1Fixed = ' <span style="color:grey">(fixed)</span>';
      }
      if (paramChecked.is1) {
        var Is1 = VIAtd1[1] / (Math.exp((VIAtd1[0] * A / n1) - 1)),
          Is1Fixed = '';
      } else {
        var Is1 = paramValues.is1,
          Is1Fixed = ' <span style="color:grey">(fixed)</span>';
      }
    } else {
      //single diode
      var n = n2;
    }

    if (paramChecked.rs) {
      var Rs = estimRs(array, T, n),
        RsFixed = '';
    } else {
      var Rs = paramValues.rs,
        RsFixed = ' <span style="color:grey">(fixed)</span>';
    }

    if (paramChecked.is2) {
      var Is2 = VIAtd2[1] / (Math.exp((VIAtd2[0] - VIAtd2[1] * Rs) * A / n2) - 1),
        Is2Fixed = '';
    } else {
      var Is2 = paramValues.is2,
        Is2Fixed = ' <span style="color:grey">(fixed)</span>';
    }

    if (paramChecked.rp1) {
      var newRp = userData.estimatedParameters.Rp,
        RpFixed = '';
    } else {
      var newRp = paramValues.rp1,
        RpFixed = ' <span style="color:grey">(fixed)</span>';
    }

    $('td.estimation#rp1').text(newRp.toPrecision(3));
    $('td.estimation#rs').text(Rs.toPrecision(2));
  
    if (dualDiode) {
      return {
        n1: n1,
        n2: n2,
        Is1: Is1,
        Is2: Is2,
        Rp1: newRp,
        Rs: Rs
      };
    } else {
      return {
        n1: n2,
        Is1: Is2,
        Rp1: newRp,
        Rs: Rs
      };
    }
  }

  function estimRs(array, T, n) {
    var dIdV = deriv(array),
      i = array.length - 2,
      dIdVati = dIdV[i - 1][1],
      exp,
      A = main.q / (n * main.k * T),
      B, C,
      IVati = array[i],
      I = IVati[1],
      V = IVati[0],
      Rs = 0;

    do {
      exp = Math.exp(A * (V - I * Rs));
      B = A * exp / (exp - 1);
      C = B / (1 / I + Rs * B);
      Rs += 0.01;
    } while (C > dIdVati)
    return Rs;
  }

  function updateParams(params, plot, updateRangeInput) {
    // Update number input and result table

    if (updateRangeInput) {
      var evt = document.createEvent('HTMLEvents');
      evt.initEvent('change', false, false);
    }

    for (let param of params) {
      const id = param[0],
        value = param[1];

      let element = $('[type=number].' + id).get(0);
      
      if (updateRangeInput) {
        element.dispatchEvent(evt);
      }

      const $td = $('td#final-' + id),
        isScaleLog = $(element).hasClass('logscale'),
        formattedValue = (isScaleLog) ? value.toExponential(2) : value.toPrecision(2);

      element.value = value;
      $td
        .text(formattedValue);
    }
    main.calcIV(plot);
  }

  function vary() {
    // Varies checked diode parameters until
    // sum of square residuals is minimized

    var param, oOO, id, eps = main.mchEps;

    const allParams = main.getAllParams();

    var n1 = allParams.value.n1,
      n1vary = allParams.checked.n1,
      Is1 = allParams.value.is1,
      Is1vary = allParams.checked.is1,
      Rp = allParams.value.rp1,
      Rpvary = allParams.checked.rp1,
      Rs = allParams.value.rs,
      Rsvary = allParams.checked.rs;
    
    // Single diode model
    let params = [
      ['n1', n1, eps, n1vary],
      ['is1', Is1, eps, Is1vary],
      ['rp1', Rp, eps, Rpvary],
      ['rs', Rs, eps, Rsvary]
    ];

    if (document.getElementById('doubleDiode').checked) {
      // Dual diode model
      var Is2 = allParams.value.Is2,
        Is2vary = allParams.checked.Is2,
        n2 = allParams.value.n2,
        n2vary = allParams.checked.n2;
      params = [['n1', n1, eps, n1vary], ['n2', n2, eps, n2vary], ['is1', Is1, eps, Is1vary], ['is2', Is2, eps, Is2vary], ['rp1', Rp, eps, Rpvary], ['rs', Rs, eps, Rsvary]];
    }

    var del,
      S,
      newPar,
      j = 0,
      ii = 0,
      sign,
      stop = false;

    interval = setInterval(
      function () {
        S = SqResSum;
        var newPars = [];
        //del = delS;
        for (var i = 0; i < params.length; i++) {
          if (params[i][3]) {
            // This parameter is allowed to vary
            del = delS[i];
            sign = del / Math.abs(del);

            newPar = params[i][1] * Math.pow((1 + params[i][2]), -sign); //update parameter

            updateParams([[params[i][0], newPar]], false, false);

            j = 0;
            while (del / Math.abs(del) != delS[i] / Math.abs(delS[i]) && j < 100 && newPar !== 0) {
              params[i][2] /= 2;
              newPar = params[i][1] * Math.pow((1 + params[i][2]), -sign); //update parameter
              updateParams([[params[i][0], newPar]], false, false);
              j++;
            }

            var jj = 0;
            while (del / Math.abs(del) == delS[i] / Math.abs(delS[i]) && jj < 100 && newPar !== 0) {
              params[i][2] *= 2;
              newPar = params[i][1] * Math.pow((1 + params[i][2]), -sign); //update parameter
              updateParams([[params[i][0], newPar]], false, false);

              jj++;
            }
            params[i][1] = newPar;
            newPars.push(newPar);

            if (isNaN(newPar)) {
              stop += true;
            }
          }
        }

        ii++;

        const dS = SqResSum - S;

        if (typeof S === 'number'){
          $('#ds').text(dS.toExponential(2));
        } else {
          $('#ds').empty();
        }

        const threshold = document.getElementById('threshold').value,
          fitSuccessful = Math.abs(dS) < threshold;

        if (fitSuccessful || ii > 1000 || stop) {
          console.log('fitSuccessful: ' + fitSuccessful);
          console.log('Too many iterations: ' +  (ii > 1000));
          console.log('NaN: ' + stop);

          if (fitSuccessful){
            const addContext = true;
            main.tableSuccessContext(addContext);
          }
          main.togglePlayButton();
          const start = false;
          startPauseVary(start);

          // Sync number and range inputs
          main.syncAllInputs();
        }
        if (document.webkitHidden) {
          // no use to plot: the page is not visible (Webkit only)
        } else {
          main.combDataAndCalc(/*arrayCalc, plotStyle, scale*/);
        }
      }
      , 1)
  }

  function startPauseVary(start) {
    // start parameter is a boolean

    if (start === true) {
      const addContext = false;
      main.tableSuccessContext(addContext);
      vary();
    } else {
      clearInterval(interval);
    }
  }

  return {
    calcIrpAndNonLinRevCurr: calcIrpAndNonLinRevCurr,
    calcSqResSum: calcSqResSum,
    estimD1D2Rs: estimD1D2Rs,
    estimRp: estimRp,
    findDiodes: findDiodes,
    startPauseVary: startPauseVary,
    toggleIrp: toggleIrp,
    toggleNonLinCurr: toggleNonLinCurr,
    updateParams: updateParams
  }

}();