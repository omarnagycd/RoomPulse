//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();


const HTML="<!DOCTYPE html>\n\n<html dir=\"rtl\" lang=\"ar\"><head><meta charset=\"utf-8\"/><meta content=\"width=device-width, initial-scale=1\" name=\"viewport\"/><meta content=\"#E60000\" name=\"theme-color\"/><title>RoomPulse</title><style>\n*{box-sizing:border-box}body{margin:0;background:#fff;color:#252525;font-family:Tahoma,Arial,sans-serif;font-size:16px;line-height:1.85}main{max-width:1040px;margin:auto;padding:28px 24px 60px}header{border-top:5px solid #E60000;padding-top:24px;margin-bottom:28px}.eyebrow{font-size:13px;color:#E60000;font-weight:bold;letter-spacing:.2px}h1{font-weight:900;letter-spacing:-.8px;font-size:clamp(30px,5vw,46px);line-height:1.4;margin:10px 0}h2{font-size:24px;line-height:1.7;margin:8px 0 16px}h3{font-size:19px}p{margin:10px 0}a{color:#C90000;text-underline-offset:4px}button,.btn{font:inherit;padding:11px 20px;min-height:48px;border:1px solid #E60000;background:#E60000;color:white;border-radius:7px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-align:center}button.secondary,.btn.secondary{color:#B90000;background:#fff}button:disabled{opacity:.45;cursor:default}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #252525;outline-offset:3px}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.muted,small{color:#626262;font-size:14px}.notice{border:1px solid #ecdada;border-right:4px solid #E60000;padding:16px 18px;border-radius:6px;margin:20px 0;background:#fff8f8}.error{color:#AF0000}.card{border-top:1px solid #eadede;margin-top:30px;padding-top:28px}label{display:block;font-size:14px;font-weight:bold;margin-bottom:6px}textarea{font:inherit;line-height:1.8;min-height:150px;resize:vertical;width:100%;padding:14px;border:1px solid #c9bebe;border-radius:7px;color:#252525;background:#fff}textarea:focus-visible{outline:3px solid #252525;outline-offset:3px}.mode-buttons{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 24px}.mode-buttons button[aria-pressed=\"true\"]{background:#E60000;color:#fff}.written-answer{padding:18px 20px;border:1px solid #eadede;border-radius:7px;background:#fffafa;white-space:pre-wrap;overflow-wrap:anywhere}.written-answer small{display:block;margin-bottom:8px;color:#A90000}input{font:inherit;padding:12px 14px;border:1px solid #c9bebe;background:#fff;border-radius:7px;width:100%;min-height:48px;color:#252525}.fields{display:grid;gap:17px;max-width:720px}.topnav{display:flex;justify-content:space-between;align-items:center;gap:12px}.topnav a{font-size:14px}.invite{display:grid;gap:24px;align-items:center}.code{font-size:clamp(38px,8vw,58px);font-weight:bold;letter-spacing:8px;line-height:1.5;color:#E60000;direction:ltr;text-align:right}.qrbox{margin:0;text-align:center}.qrbox img{width:208px;height:208px;max-width:100%;display:block;margin:auto}.qrbox figcaption{font-size:13px;color:#626262}.status{display:flex;align-items:center;gap:7px;font-size:13px;color:#626262;margin-bottom:12px}.dot{width:8px;height:8px;background:#E60000;border-radius:50%;display:inline-block}.metric{display:flex;align-items:baseline;gap:14px;margin:20px 0}.metric strong{font-size:46px;color:#E60000;line-height:1.3}.results{display:grid;gap:22px}.result-head{display:flex;justify-content:space-between;gap:14px;margin-bottom:8px}.result-head strong{white-space:nowrap;color:#C90000}.track{height:11px;background:#fff0f0;border-radius:5px;overflow:hidden}.bar{height:100%;background:#E60000;transition:width .3s}.choices{display:grid;gap:12px;margin:22px 0}.choice{width:100%;text-align:right;justify-content:flex-start;border-color:#d9cccc;color:#252525;background:#fff;padding:17px}.choice .number{display:grid;place-items:center;min-width:30px;height:30px;border-radius:5px;background:#fff0f0;color:#A90000}.choice.selected{border:2px solid #E60000;background:#fff5f5;padding:16px}.choice .answer{flex:1}.joincode{max-width:330px;font-size:26px;letter-spacing:6px;direction:ltr}.hidden{display:none!important}footer{margin-top:40px;padding-top:20px;border-top:1px solid #eadede;font-size:12px;color:#626262}.url{direction:ltr;display:block;overflow-wrap:anywhere;font-size:13px}#globalError:empty{display:none}#globalError{position:relative;padding:12px 16px;border:1px solid #E60000;border-radius:6px;background:#fff6f6;color:#A90000;margin-bottom:15px}.bank-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.bank-tabs button{font-size:14px;padding:8px 12px}.bank-list{display:grid;gap:10px;margin-bottom:20px}.bank-pick{background:#fff;color:#252525;border-color:#e6d5d5;text-align:start;justify-content:space-between;width:100%}.bank-pick span{flex:1}.bank-pick small{color:#a90000;white-space:nowrap}.bank-panel{margin:20px 0 30px;padding:20px;border:1px solid #eadede;border-radius:8px;background:#fffafa}.bank-panel summary{cursor:pointer;min-height:44px;font-weight:bold}.welcome-grid{display:grid;gap:20px}.welcome-grid>div{border:1px solid #eadede;padding:24px;border-radius:8px}.welcome-grid h2{font-size:23px}.success{font-weight:bold;color:#AE0000}#qrLink{display:inline-block}.header-intro{max-width:720px;color:#595959}@media(min-width:740px){main{padding:42px 54px 64px}.invite{grid-template-columns:1fr 250px}.welcome-grid{grid-template-columns:1fr 1fr}}@media(max-width:360px){main{padding:20px 16px}.result-head{flex-direction:column;gap:0}.code{letter-spacing:5px}.actions>*{width:100%}h2{font-size:21px}}\n\n.topnav-with-language{flex-wrap:wrap}.language-switch{display:flex;gap:4px;margin-inline-start:auto;flex-shrink:0;padding:3px;border:1px solid #eadede;border-radius:9px;background:#fff}.language-switch button{font-size:13px;font-weight:bold;min-height:40px;min-width:44px;padding:5px 10px;border-color:transparent}.language-switch button[aria-pressed=\"true\"]{background:#E60000;color:#fff}.notice{border-right:1px solid #ecdada;border-inline-start:4px solid #E60000}.choice{text-align:start}.code{text-align:right}html[dir=\"ltr\"] .code{text-align:left}html[lang=\"en\"] body{font-family:Arial,Helvetica,sans-serif;line-height:1.65}html[lang=\"en\"] .eyebrow{letter-spacing:.5px}input[dir=\"auto\"],textarea[dir=\"auto\"]{text-align:start}.bank-tabs button[aria-pressed=\"true\"]{background:#E60000;color:white}.topnav>.eyebrow{flex:1;min-width:180px}.bank-panel{padding:18px}.bank-pick{overflow-wrap:anywhere}.fields{width:100%}@media(max-width:480px){main{padding:22px 18px 44px}.topnav>.eyebrow{flex-basis:100%;font-size:12px}.topnav>a{margin-inline-end:auto}.language-switch{margin-inline-start:0}.welcome-grid>div{padding:20px}.bank-panel{padding:14px}.bank-pick{padding:12px 10px}.bank-pick small{font-size:12px}.mode-buttons{gap:8px}.mode-buttons button{padding:9px 13px;font-size:14px}.qrbox img{width:208px;height:208px}.topnav{row-gap:9px}h1{margin-top:18px}}\n.timer-setup{max-width:720px;border:1px solid #eadede;border-radius:8px;padding:18px;margin:24px 0}.timer-setup h3{margin:0 0 8px}.timer-setup .mode-buttons{margin-bottom:10px}.timer-fields{display:flex;gap:12px;align-items:end;direction:ltr;max-width:330px}.timer-fields>div{flex:1;min-width:0}.timer-fields label{direction:inherit}.timer-fields input{text-align:center;font-variant-numeric:tabular-nums}.timer-separator{padding-bottom:10px;font-size:24px}.countdown{display:grid;grid-template-columns:1fr auto;gap:6px 18px;align-items:center;padding:16px 20px;border:1px solid #eed1d1;border-inline-start:4px solid #E60000;border-radius:8px;background:#fffafa;margin:18px 0 24px;max-width:720px}.countdown-value{font-size:34px;color:#E60000;line-height:1.2;font-variant-numeric:tabular-nums;white-space:nowrap}.countdown-label{font-weight:bold}.countdown-note{grid-column:1/-1;font-size:14px;margin:0}.countdown.urgent{border-color:#E60000;background:#fff2f2}.countdown.expired .countdown-value{color:#666}.countdown.expired{background:#fafafa;border-color:#ccc}@media(max-width:360px){.countdown{padding:14px;gap:8px}.countdown-value{font-size:28px}.timer-setup{padding:14px}}\n\n.theme-toggle{font-size:13px;min-height:44px;padding:6px 12px;gap:7px;white-space:nowrap}.theme-icon{font-size:22px;line-height:1}.topnav-with-language{gap:10px}.language-switch{margin-inline-start:auto}html[data-theme=\"dark\"] body{background:#141414;color:#f2eeee}html[data-theme=\"dark\"] a{color:#ff9292}html[data-theme=\"dark\"] .header-intro,html[data-theme=\"dark\"] .muted,html[data-theme=\"dark\"] small,html[data-theme=\"dark\"] .status,html[data-theme=\"dark\"] .qrbox figcaption,html[data-theme=\"dark\"] footer{color:#c2baba}html[data-theme=\"dark\"] .eyebrow,html[data-theme=\"dark\"] .success,html[data-theme=\"dark\"] .error,html[data-theme=\"dark\"] .result-head strong,html[data-theme=\"dark\"] .metric strong,html[data-theme=\"dark\"] .code,html[data-theme=\"dark\"] .countdown-value{color:#ff9292}html[data-theme=\"dark\"] input,html[data-theme=\"dark\"] textarea{background:#202020;border-color:#685252;color:#f2eeee}html[data-theme=\"dark\"] input::placeholder,html[data-theme=\"dark\"] textarea::placeholder{color:#bcb0b0}html[data-theme=\"dark\"] .welcome-grid>div,html[data-theme=\"dark\"] .card,html[data-theme=\"dark\"] footer,html[data-theme=\"dark\"] .timer-setup{border-color:#4f3b3b}html[data-theme=\"dark\"] .bank-panel,html[data-theme=\"dark\"] .notice,html[data-theme=\"dark\"] .written-answer,html[data-theme=\"dark\"] .countdown{background:#261c1c;border-color:#634343;border-inline-start-color:#E60000}html[data-theme=\"dark\"] .bank-pick,html[data-theme=\"dark\"] .choice{background:#202020;color:#f2eeee;border-color:#634343}html[data-theme=\"dark\"] .bank-pick small,html[data-theme=\"dark\"] .written-answer small{color:#ffaaaa}html[data-theme=\"dark\"] .choice.selected{background:#3a1b1b;border-color:#E60000}html[data-theme=\"dark\"] .choice .number,html[data-theme=\"dark\"] .track{background:#4b2525;color:#ffb0b0}html[data-theme=\"dark\"] button.secondary,html[data-theme=\"dark\"] a.btn.secondary{background:transparent;color:#ffaaaa;border-color:#b14c4c}html[data-theme=\"dark\"] .mode-buttons button[aria-pressed=\"true\"],html[data-theme=\"dark\"] .bank-tabs button[aria-pressed=\"true\"],html[data-theme=\"dark\"] .language-switch button[aria-pressed=\"true\"]{background:#E60000;color:#fff;border-color:#E60000}html[data-theme=\"dark\"] .language-switch{background:#202020;border-color:#634343}html[data-theme=\"dark\"] .language-switch button{border-color:transparent}html[data-theme=\"dark\"] #qrLink{background:white;padding:10px;border-radius:8px}html[data-theme=\"dark\"] #globalError{background:#361d1d;color:#ffc1c1}html[data-theme=\"dark\"] button:focus-visible,html[data-theme=\"dark\"] a:focus-visible,html[data-theme=\"dark\"] input:focus-visible,html[data-theme=\"dark\"] textarea:focus-visible{outline-color:#fff}html[data-theme=\"dark\"] .countdown.urgent{background:#391b1b;border-color:#E60000}html[data-theme=\"dark\"] .countdown.expired{background:#222;border-color:#666}html[data-theme=\"dark\"] .countdown.expired .countdown-value{color:#bbb}@media(max-width:480px){.topnav-with-language{gap:8px}.topnav>a{margin-inline-end:auto}.language-switch{margin-inline-start:0}.theme-toggle{padding:5px 9px;font-size:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}\nhtml[dir=\"rtl\"] .fields input:placeholder-shown{text-align:right}html[dir=\"ltr\"] .fields input:placeholder-shown{text-align:left}\nselect{width:100%;padding:14px;border:1px solid #bbb;border-radius:12px;font:inherit;background:var(--surface,#fff);color:inherit}html[data-theme=\"dark\"] select{background:#202126;color:#fff}.ranking-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:start;gap:10px;padding:14px 0;border-bottom:1px solid #8884}.ranking-row small{display:block;margin-top:5px}.ranking-place{font-weight:900;color:#E60000;font-size:1.3rem}.ranking-row strong{overflow-wrap:anywhere}.ranking-points{text-align:end;white-space:nowrap;font-weight:800}\n\n.section-tabs{margin-block:16px 24px}.section-tabs button[aria-pressed=\"true\"]{background:#E60000;color:#fff}.wheel-layout{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(280px,1.2fr);gap:32px;align-items:start}.wheel-stage{text-align:center}.wheel-stage canvas{display:block;width:100%;max-width:560px;height:auto;aspect-ratio:1;margin:0 auto 18px}.wheel-editor textarea{min-height:250px;resize:vertical;line-height:1.7}.wheel-result{margin-top:22px;padding:20px;border:2px solid #E60000;border-radius:18px;background:#fff5f5}.wheel-result p{margin:0 0 10px}.wheel-result strong{display:block;font-size:clamp(1.4rem,5vw,2.2rem);overflow-wrap:anywhere;color:#B60000}html[data-theme=\"dark\"] .wheel-result{background:#2d171b}html[data-theme=\"dark\"] .wheel-result strong{color:#ff9b9b}@media(max-width:700px){.wheel-layout{grid-template-columns:minmax(0,1fr);gap:24px}.wheel-editor textarea{min-height:180px}.wheel-stage{min-width:0}}\n/* RoomPulse: visual-only red/white glass system. No activity or data changes. */\n:root{--glass-surface:linear-gradient(140deg,#fffffff0,#ffffff85);--glass-line:#ffffffef;--glass-inset:#ffffff;--glass-shadow:0 18px 50px #7b15200c,inset 0 1px 0 #fff;--glass-ink:#30242a;--glass-muted:#6b5960;--glass-accent:#d90016;--glass-field:#ffffffb8;--glass-field-line:#d9b9c0}html{background:#fff3f4}body{min-height:100vh;color:var(--glass-ink);background:radial-gradient(ellipse at 0% 8%,#f6b2bc6b,transparent 43%),radial-gradient(ellipse at 100% 48%,#f5d5d982,transparent 42%),radial-gradient(ellipse at 8% 90%,#f1e7ec,transparent 43%),linear-gradient(145deg,#fff9fa,#f8ecef);background-attachment:fixed}main{max-width:1160px;padding-top:34px}header{border:1px solid var(--glass-line);border-top:1px solid var(--glass-line);background:var(--glass-surface);backdrop-filter:blur(26px) saturate(145%);-webkit-backdrop-filter:blur(26px) saturate(145%);padding:28px 32px;border-radius:30px;box-shadow:var(--glass-shadow);position:relative;overflow:hidden}header:before{content:\"\";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 0% 0%,#fff9,transparent 68%);z-index:0}header>*{position:relative}header h1{letter-spacing:-1.6px;font-weight:900;margin-top:22px}.header-intro{max-width:780px;color:var(--glass-muted)}.topnav-with-language{padding-bottom:16px;border-bottom:1px solid #b73a4a16}.topnav>a{font-weight:700;text-decoration:none}.language-switch{background:#ffffff61;border:1px solid var(--glass-line);border-radius:18px;box-shadow:inset 0 1px 0 var(--glass-inset);padding:4px}.language-switch button{border-radius:13px;box-shadow:none}.section-tabs{display:flex;gap:8px;width:max-content;max-width:100%;padding:6px;border:1px solid var(--glass-line);background:var(--glass-surface);backdrop-filter:blur(24px);border-radius:22px;box-shadow:var(--glass-shadow)}.section-tabs button{min-width:110px;border-radius:16px!important}.card,.welcome-grid>div,.bank-panel,.timer-setup,.countdown,.written-answer,.wheel-result{border:1px solid var(--glass-line);border-radius:26px;background:var(--glass-surface);box-shadow:var(--glass-shadow);backdrop-filter:blur(24px) saturate(130%);-webkit-backdrop-filter:blur(24px) saturate(130%)}.welcome-grid{gap:24px}.welcome-grid>div{padding:28px 30px}.welcome-grid h2{font-size:26px;letter-spacing:-.6px}.welcome-grid>div>p{color:var(--glass-muted)}.card{padding:28px 30px;margin-top:26px}.bank-panel{padding:22px}.timer-setup{padding:22px}.notice{background:#fff8f8a8;border:1px solid #e8b6bf88;border-inline-start:4px solid #e60000;border-radius:20px;color:var(--glass-muted);backdrop-filter:blur(20px)}button,.btn{border-radius:16px;border:1px solid #e60000;background:linear-gradient(145deg,#ef2234,#d90016);color:#fff;box-shadow:0 6px 16px #a71c2b16,inset 0 1px 0 #ffffff40;transition:box-shadow .2s,background .2s,border-color .2s}button:hover:not(:disabled),.btn:hover{box-shadow:0 8px 22px #a71c2b24,inset 0 1px 0 #ffffff55}button.secondary,.btn.secondary{background:linear-gradient(145deg,#ffffffe3,#ffffff61);border-color:var(--glass-line);color:#ad0015;box-shadow:0 5px 15px #78223609,inset 0 1px 0 var(--glass-inset);backdrop-filter:blur(18px)}.mode-buttons button[aria-pressed=true],.bank-tabs button[aria-pressed=true],.language-switch button[aria-pressed=true],.section-tabs button[aria-pressed=true]{background:linear-gradient(145deg,#ef2234,#d90016);border-color:#e60000;color:#fff;box-shadow:0 6px 18px #a71c2b24,inset 0 1px 0 #ffffff45}input,textarea,select{background:var(--glass-field);border:1px solid var(--glass-field-line);border-radius:16px;color:var(--glass-ink);box-shadow:inset 0 2px 4px #59344205;backdrop-filter:blur(12px)}input::placeholder,textarea::placeholder{color:#89767e}input:focus-visible,textarea:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #b50018;outline-offset:3px}.bank-pick,.choice{background:var(--glass-field);border:1px solid #f5ffffee;border-radius:18px;color:var(--glass-ink);box-shadow:0 4px 14px #5f152506,inset 0 1px 0 var(--glass-inset)}.bank-pick{padding:14px 18px}.choice{padding:18px}.choice.selected{border:2px solid #e60000;background:#fff0f4e8;padding:17px}.choice .number{border-radius:11px;background:#ffe4e9;color:#ad0015}.track{height:12px;border:1px solid #ffffff90;background:#b7233810;border-radius:12px}.bar{background:linear-gradient(90deg,#e60000,#f36273);border-radius:12px}.qrbox{background:#fff;border:1px solid #fff;border-radius:24px;padding:20px;box-shadow:0 15px 35px #5e233015}.qrbox img{background:#fff;image-rendering:auto}.qrbox figcaption{color:#66565c}html[data-theme=dark] #qrLink{padding:0;border-radius:0}.code{color:#dc0018;font-variant-numeric:tabular-nums}.ranking-row{padding:17px 12px;border-bottom:1px solid #b94b5c20;border-radius:12px}.ranking-place{color:#e60000}.metric{padding:18px 22px;border-radius:20px;background:#ffffff51;border:1px solid var(--glass-line);width:max-content;max-width:100%}.wheel-stage{border:1px solid var(--glass-line);border-radius:28px;padding:20px;background:var(--glass-surface);box-shadow:var(--glass-shadow);backdrop-filter:blur(25px)}.wheel-editor{min-width:0}.wheel-result{border:2px solid #e60000}.countdown{border-inline-start:4px solid #e60000}.countdown.urgent{background:#ffe1e8db;border-color:#e60000}.countdown.expired{background:#f6f0f3c9;border-color:#99868e}.written-answer{padding:20px 24px}.muted,small,.status,footer{color:var(--glass-muted)}footer{border-color:#b8556825;padding-inline:12px}#globalError{background:#fff0f2ed;border-radius:16px;border-color:#e60000}h2{letter-spacing:-.5px}.topnav,.fields,.bank-list,.results,.wheel-layout{min-width:0}select{appearance:auto}\nhtml[data-theme=dark]{--glass-surface:linear-gradient(140deg,#fff1f416,#f0d2da06);--glass-line:#ffe0e933;--glass-inset:#fff4f421;--glass-shadow:0 18px 50px #0002,inset 0 1px 0 #ffffff1d;--glass-ink:#f6edf0;--glass-muted:#cbb9c1;--glass-field:#fff1f40b;--glass-field-line:#d4a9b64d;background:#1b1117}html[data-theme=dark] body{background:radial-gradient(ellipse at 0% 8%,#8e15374b,transparent 43%),radial-gradient(ellipse at 100% 48%,#64374645,transparent 45%),linear-gradient(145deg,#23151c,#171319);color:var(--glass-ink)}html[data-theme=dark] header:before{background:radial-gradient(ellipse at 0% 0%,#ffeff507,transparent 68%)}html[data-theme=dark] .topnav-with-language{border-color:#ffe0e918}html[data-theme=dark] .card,html[data-theme=dark] .welcome-grid>div,html[data-theme=dark] .bank-panel,html[data-theme=dark] .timer-setup,html[data-theme=dark] .countdown,html[data-theme=dark] .written-answer,html[data-theme=dark] .wheel-result{background:var(--glass-surface);border-color:var(--glass-line)}html[data-theme=dark] .language-switch{background:#ffffff06;border-color:var(--glass-line)}html[data-theme=dark] button.secondary,html[data-theme=dark] .btn.secondary{background:linear-gradient(145deg,#fff1f413,#fff1f403);border-color:var(--glass-line);color:#ffb1c1}html[data-theme=dark] .mode-buttons button[aria-pressed=true],html[data-theme=dark] .bank-tabs button[aria-pressed=true],html[data-theme=dark] .language-switch button[aria-pressed=true]{background:linear-gradient(145deg,#ef2234,#d90016);border-color:#e60000;color:#fff}html[data-theme=dark] input,html[data-theme=dark] textarea,html[data-theme=dark] select,html[data-theme=dark] .bank-pick,html[data-theme=dark] .choice{background:var(--glass-field);border-color:var(--glass-field-line);color:var(--glass-ink)}html[data-theme=dark] select option{background:#2d1f28;color:#fff}html[data-theme=dark] input::placeholder,html[data-theme=dark] textarea::placeholder{color:#b5a2ab}html[data-theme=dark] .notice{background:#ffb7ca08;border-color:#ffb7ca35;border-inline-start-color:#e60000;color:var(--glass-muted)}html[data-theme=dark] .choice.selected{background:#ad234b35;border-color:#ff6b87}html[data-theme=dark] .choice .number{background:#ff809923;color:#ffc0cd}html[data-theme=dark] .track{background:#ff83951c}html[data-theme=dark] .metric{background:#ffffff06;border-color:var(--glass-line)}html[data-theme=dark] .countdown.urgent{background:#941b3d3b;border-color:#ef4965}html[data-theme=dark] .countdown.expired{background:#3e303a55;border-color:#9b8790}html[data-theme=dark] .ranking-row{border-color:#ffe0e91c}html[data-theme=dark] .qrbox{border-color:#fff;background:#fff}html[data-theme=dark] .qrbox figcaption{color:#66565c}html[data-theme=dark] footer{border-color:#ffe0e924}html[data-theme=dark] #globalError{background:#501a2bda;color:#ffd6e0}html[data-theme=dark] input:focus-visible,html[data-theme=dark] textarea:focus-visible,html[data-theme=dark] select:focus-visible,html[data-theme=dark] button:focus-visible,html[data-theme=dark] a:focus-visible{outline-color:#ffbbc9}\n@media(max-width:700px){main{padding:20px 16px 40px}header{padding:21px 20px;border-radius:26px}.topnav-with-language{gap:8px}header h1{font-size:38px;letter-spacing:-1.2px;margin-top:22px}.header-intro{font-size:14px;line-height:1.85}.welcome-grid>div,.card{padding:23px 20px;border-radius:25px}.bank-panel,.timer-setup{padding:17px;border-radius:21px}.welcome-grid h2{font-size:23px}.section-tabs{width:100%;justify-content:stretch}.section-tabs button{flex:1;min-width:0}.language-switch button{min-width:42px;padding:5px 8px}.theme-toggle{font-size:12px;padding:6px 9px}.topnav>a{font-size:13px}.wheel-stage{padding:15px}.wheel-layout{gap:24px}.bank-pick{padding:13px 12px}.qrbox{max-width:300px;width:100%;margin:auto}.countdown{padding:16px}.code{letter-spacing:6px}.choice{padding:16px}.choice.selected{padding:15px}.written-answer{padding:18px}.metric{padding:15px 18px}}@media(prefers-reduced-transparency:reduce){:root{--glass-surface:#fff;--glass-field:#fff}html[data-theme=dark]{--glass-surface:#2d2028;--glass-field:#30222b}}@media(prefers-reduced-motion:reduce){button,.btn,.bar{transition:none!important}}\n\n</style></head><body><main><header><div class=\"topnav topnav-with-language\"><a href=\"/\"><span data-i18n=\"البداية\">البداية</span></a><div aria-label=\"Language / اللغة\" class=\"language-switch\" dir=\"ltr\" role=\"group\"><button aria-pressed=\"true\" class=\"secondary\" id=\"langAR\" lang=\"ar\" type=\"button\">AR</button><button aria-pressed=\"false\" class=\"secondary\" id=\"langEN\" lang=\"en\" type=\"button\">EN</button></div><button aria-pressed=\"false\" class=\"secondary theme-toggle\" id=\"themeToggle\" type=\"button\"><span aria-hidden=\"true\" class=\"theme-icon\">◐</span><span id=\"themeLabel\">الوضع الداكن</span></button></div><h1><bdi><strong>RoomPulse</strong></bdi></h1><p class=\"header-intro\"><span data-i18n=\"سؤال واحد، كود واحد، ونقاش يشارك فيه الكل. بالاسم أو من غيره، ومن غير تسجيل حساب.\">سؤال واحد، كود واحد، ونقاش يشارك فيه الكل. بالاسم أو من غيره، ومن غير تسجيل حساب.</span></p></header><nav aria-label=\"App sections\" class=\"mode-buttons section-tabs\"><button aria-pressed=\"true\" class=\"secondary\" id=\"activitiesTab\" type=\"button\"><span data-i18n=\"الأنشطة\">الأنشطة</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"wheelTab\" type=\"button\"><span data-i18n=\"العجلة\">العجلة</span></button></nav><div id=\"globalError\" role=\"alert\"></div>\n<section id=\"welcome\"><div class=\"welcome-grid\"><div><span class=\"eyebrow\"><span data-i18n=\"للمدرب\">للمدرب</span></span><h2><span data-i18n=\"اسمع رأي القاعة\">اسمع رأي القاعة</span></h2><p><span data-i18n=\"اكتب سؤالك، اعرض الـ QR، وشوف الردود بتوصل من أجهزة المتدربين.\">اكتب سؤالك، اعرض الـ QR، وشوف الردود بتوصل من أجهزة المتدربين.</span></p><div class=\"actions\"><button id=\"startTrainer\"><span data-i18n=\"جهّز سؤال\">جهّز سؤال</span></button></div></div><div><span class=\"eyebrow\"><span data-i18n=\"للمتدرب\">للمتدرب</span></span><h2><span data-i18n=\"جاهز تشارك؟\">جاهز تشارك؟</span></h2><p><span data-i18n=\"معاك كود من المدرب؟ ادخل النشاط واختار إجابتك.\">معاك كود من المدرب؟ ادخل النشاط واختار إجابتك.</span></p><div class=\"actions\"><a class=\"btn secondary\" href=\"/join\"><span data-i18n=\"ادخل بكود السيشن\">ادخل بكود السيشن</span></a></div></div></div><section class=\"card\"><h2><span data-i18n=\"لف واختار\">لف واختار</span></h2><p><span data-i18n=\"اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.\">اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.</span></p><button id=\"openWheel\"><span data-i18n=\"العجلة\">العجلة</span></button></section><section class=\"card\"><span class=\"eyebrow\"><span data-i18n=\"للمدرب · القسم الثالث\">للمدرب · القسم الثالث</span></span><h2><span data-i18n=\"بنك أسئلة جاهزة\">بنك أسئلة جاهزة</span></h2><p><span data-i18n=\"٥٠ سؤال خفيف في ٥ أقسام. اختار سؤال وعدّله براحتك قبل ما تبدأ.\">٥٠ سؤال خفيف في ٥ أقسام. اختار سؤال وعدّله براحتك قبل ما تبدأ.</span></p><button class=\"secondary\" id=\"openBank\"><span data-i18n=\"اختار من بنك الأسئلة\">اختار من بنك الأسئلة</span></button></section><div class=\"notice hidden\" id=\"resumeBox\"><p><span data-i18n=\"عندك سيشن مفتوح على المتصفح ده.\">عندك سيشن مفتوح على المتصفح ده.</span></p><button class=\"secondary\" id=\"resume\"><span data-i18n=\"ارجع لشاشة المدرب\">ارجع لشاشة المدرب</span></button></div><div class=\"notice\"><strong><span data-i18n=\"نسخة أولية لايف\">نسخة أولية لايف</span></strong><p><span data-i18n=\"تحتاج إنترنت على كل جهاز. التحديث كل ٥ ثوانٍ. استخدم أسئلة تجريبية فقط، من غير بيانات عملاء أو معلومات حساسة.\">تحتاج إنترنت على كل جهاز. التحديث كل ٥ ثوانٍ. استخدم أسئلة تجريبية فقط، من غير بيانات عملاء أو معلومات حساسة.</span></p></div></section>\n<section class=\"hidden\" id=\"setup\"><span class=\"eyebrow\"><span data-i18n=\"من غير ما تنقل محتواك\">من غير ما تنقل محتواك</span></span><h2><span data-i18n=\"جهّز سؤال واحد\">جهّز سؤال واحد</span></h2><div class=\"notice hidden\" id=\"continuingRanking\"><p><span data-i18n=\"جولة رانكينج مستمرة. خلي المشاركين يدخلوا كل سؤال من نفس المتصفح عشان السكور يتجمع. لكل سؤال كود وQR جديد.\">جولة رانكينج مستمرة. خلي المشاركين يدخلوا كل سؤال من نفس المتصفح عشان السكور يتجمع. لكل سؤال كود وQR جديد.</span></p><button class=\"secondary\" id=\"separateRanking\" type=\"button\"><span data-i18n=\"ابدأ جولة منفصلة بدل دي\">ابدأ جولة منفصلة بدل دي</span></button></div><details class=\"bank-panel\" id=\"bankPanel\"><summary><span data-i18n=\"اختار من بنك الأسئلة · ٥٠ سؤال\">اختار من بنك الأسئلة · ٥٠ سؤال</span></summary><p class=\"muted\"><span data-i18n=\"اختيار السؤال بيملأ الحقول بس، مش بيبدأ السيشن. راجع وعدّل قبل النشر.\">اختيار السؤال بيملأ الحقول بس، مش بيبدأ السيشن. راجع وعدّل قبل النشر.</span></p><div aria-label=\"أقسام بنك الأسئلة\" class=\"bank-tabs\" data-i18n-aria-label=\"أقسام بنك الأسئلة\" id=\"bankTabs\" role=\"group\"></div><p id=\"bankCategory\"></p><div class=\"bank-list\" id=\"bankList\"></div><p class=\"success\" id=\"bankSelected\" role=\"status\"></p></details><label><span data-i18n=\"هوية المشاركين\">هوية المشاركين</span></label><div aria-label=\"هوية المشاركين\" class=\"mode-buttons\" data-i18n-aria-label=\"هوية المشاركين\" role=\"group\"><button aria-pressed=\"true\" class=\"secondary\" id=\"identityAnonymous\"><span data-i18n=\"من غير أسماء\">من غير أسماء</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"identityNamed\"><span data-i18n=\"بالأسماء\">بالأسماء</span></button></div><p class=\"muted\" id=\"identityHint\"><span data-i18n=\"هتشوف الردود من غير أسماء، زي الوضع الحالي.\">هتشوف الردود من غير أسماء، زي الوضع الحالي.</span></p><label><span data-i18n=\"نوع الإجابة\">نوع الإجابة</span></label><div aria-label=\"نوع الإجابة\" class=\"mode-buttons\" data-i18n-aria-label=\"نوع الإجابة\" role=\"group\"><button aria-pressed=\"true\" class=\"secondary\" id=\"modePoll\"><span data-i18n=\"اختيارات\">اختيارات</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"modeText\"><span data-i18n=\"إجابة مكتوبة\">إجابة مكتوبة</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"modeRanking\" type=\"button\"><span data-i18n=\"رانكينج\">رانكينج</span></button></div><p class=\"muted\" id=\"modeHint\"><span data-i18n=\"المتدرب يختار إجابة واحدة من ٣ اختيارات.\">المتدرب يختار إجابة واحدة من ٣ اختيارات.</span></p><section class=\"card hidden\" id=\"rankingSetup\"><h3><span data-i18n=\"إعدادات الرانكينج\">إعدادات الرانكينج</span></h3><p><span data-i18n=\"في إجابة صح؟\">في إجابة صح؟</span></p><div class=\"mode-buttons\"><button aria-pressed=\"true\" class=\"secondary\" id=\"rankingNoCorrect\" type=\"button\"><span data-i18n=\"من غير إجابة صح\">من غير إجابة صح</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"rankingHasCorrect\" type=\"button\"><span data-i18n=\"في إجابة صح\">في إجابة صح</span></button></div><div class=\"hidden\" id=\"correctChoiceBox\"><label for=\"correctChoice\"><span data-i18n=\"اختار الإجابة الصحيحة\">اختار الإجابة الصحيحة</span></label><select id=\"correctChoice\"><option data-i18n=\"اختار الإجابة الصحيحة\" value=\"\">اختار الإجابة الصحيحة</option><option data-i18n=\"الاختيار الأول\" value=\"0\">الاختيار الأول</option><option data-i18n=\"الاختيار الثاني\" value=\"1\">الاختيار الثاني</option><option data-i18n=\"الاختيار الثالث\" value=\"2\">الاختيار الثالث</option></select></div><p class=\"muted\"><span data-i18n=\"الرانكينج باختيارات. الأسرع حسب وقت وصول الرد للسيرفر من فتح السؤال، فسرعة الإنترنت بتأثر. مع الإجابة الصحيحة، الردود الصح بس تدخل الترتيب.\">الرانكينج باختيارات. الأسرع حسب وقت وصول الرد للسيرفر من فتح السؤال، فسرعة الإنترنت بتأثر. مع الإجابة الصحيحة، الردود الصح بس تدخل الترتيب.</span></p><p class=\"muted\"><span data-i18n=\"النقاط لكل سؤال: ١٠٠٠ ÷ المركز، مقربة لأسفل وبحد أدنى نقطة. التعادل في الوقت ياخد نفس المركز والنقاط.\">النقاط لكل سؤال: ١٠٠٠ ÷ المركز، مقربة لأسفل وبحد أدنى نقطة. التعادل في الوقت ياخد نفس المركز والنقاط.</span></p><p class=\"muted\"><span data-i18n=\"كل سؤال ليه كود جديد. استخدموا نفس المتصفح لكل الأسئلة. النتايج مؤقتة لمدة ٢٤ ساعة، زي باقي الأوضاع.\">كل سؤال ليه كود جديد. استخدموا نفس المتصفح لكل الأسئلة. النتايج مؤقتة لمدة ٢٤ ساعة، زي باقي الأوضاع.</span></p></section><section aria-labelledby=\"timerHeading\" class=\"timer-setup\"><h3 id=\"timerHeading\"><span data-i18n=\"مؤقت السؤال\">مؤقت السؤال</span></h3><div aria-label=\"Question timer\" class=\"mode-buttons\" role=\"group\"><button aria-pressed=\"true\" class=\"secondary\" id=\"timerOff\" type=\"button\"><span data-i18n=\"من غير مؤقت\">من غير مؤقت</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"timerOn\" type=\"button\"><span data-i18n=\"بمؤقت\">بمؤقت</span></button></div><div class=\"hidden\" id=\"timerDuration\"><div class=\"timer-fields\"><div><label for=\"timerMinutes\"><span data-i18n=\"دقائق\">دقائق</span></label><input dir=\"ltr\" id=\"timerMinutes\" inputmode=\"numeric\" max=\"1439\" min=\"0\" step=\"1\" type=\"number\" value=\"1\"/></div><span aria-hidden=\"true\" class=\"timer-separator\">:</span><div><label for=\"timerSeconds\"><span data-i18n=\"ثواني\">ثواني</span></label><input dir=\"ltr\" id=\"timerSeconds\" inputmode=\"numeric\" max=\"59\" min=\"0\" step=\"1\" type=\"number\" value=\"0\"/></div></div><p class=\"muted\"><span data-i18n=\"قفل وفتح الردود مش بيوقف أو يعيد المؤقت. بعد الصفر ابدأ سيشن جديد لو عايز تكمل.\">قفل وفتح الردود مش بيوقف أو يعيد المؤقت. بعد الصفر ابدأ سيشن جديد لو عايز تكمل.</span></p></div><p class=\"muted\"><span data-i18n=\"المؤقت اختياري. بيبدأ لما تفتح السيشن، وبيقفل استقبال الردود تلقائياً عند الصفر.\">المؤقت اختياري. بيبدأ لما تفتح السيشن، وبيقفل استقبال الردود تلقائياً عند الصفر.</span></p></section><div class=\"fields\"><div><label for=\"title\"><span data-i18n=\"عنوان السيشن\">عنوان السيشن</span></label><input data-i18n-placeholder=\"اكتب عنوان السيشن\" dir=\"auto\" id=\"title\" maxlength=\"80\" placeholder=\"اكتب عنوان السيشن\" value=\"\"/></div><div><label for=\"question\"><span data-i18n=\"سؤال النقاش\">سؤال النقاش</span></label><input data-i18n-placeholder=\"اكتب سؤالك هنا\" dir=\"auto\" id=\"question\" maxlength=\"300\" placeholder=\"اكتب سؤالك هنا\" value=\"\"/></div><div class=\"option-field\"><label for=\"option0\"><span data-i18n=\"الاختيار ١\">الاختيار ١</span></label><input data-i18n-placeholder=\"اكتب الاختيار الأول\" dir=\"auto\" id=\"option0\" maxlength=\"200\" placeholder=\"اكتب الاختيار الأول\" value=\"\"/></div><div class=\"option-field\"><label for=\"option1\"><span data-i18n=\"الاختيار ٢\">الاختيار ٢</span></label><input data-i18n-placeholder=\"اكتب الاختيار الثاني\" dir=\"auto\" id=\"option1\" maxlength=\"200\" placeholder=\"اكتب الاختيار الثاني\" value=\"\"/></div><div class=\"option-field\" id=\"thirdOption\"><label for=\"option2\"><span data-i18n=\"الاختيار ٣\">الاختيار ٣</span></label><input data-i18n-placeholder=\"اكتب الاختيار الثالث\" dir=\"auto\" id=\"option2\" maxlength=\"200\" placeholder=\"اكتب الاختيار الثالث\" value=\"\"/></div></div><div class=\"actions\"><button id=\"create\"><span data-i18n=\"افتح السيشن اللايف\">افتح السيشن اللايف</span></button><a class=\"btn secondary\" href=\"/\"><span data-i18n=\"رجوع\">رجوع</span></a></div><div class=\"actions\" id=\"optionCount\"><button class=\"secondary\" id=\"twoOptions\"><span data-i18n=\"خيارين\">خيارين</span></button><button class=\"secondary\" id=\"threeOptions\"><span data-i18n=\"٣ اختيارات\">٣ اختيارات</span></button></div><p class=\"muted\"><span data-i18n=\"كل سيشن سؤال واحد، باختيارات أو إجابة مكتوبة، وصلاحيته ٢٤ ساعة. مش اختبار معتمد ولا تقييم جاهزية للعمل.\">كل سيشن سؤال واحد، باختيارات أو إجابة مكتوبة، وصلاحيته ٢٤ ساعة. مش اختبار معتمد ولا تقييم جاهزية للعمل.</span></p></section>\n<section class=\"hidden\" id=\"trainer\"><div class=\"status\" id=\"connection\" role=\"status\"><span class=\"dot\"></span><span data-i18n=\"جاري الاتصال…\">جاري الاتصال…</span></div><div aria-live=\"off\" class=\"countdown hidden\" id=\"trainerCountdown\" role=\"timer\"><span class=\"countdown-label\"></span><strong class=\"countdown-value\" dir=\"ltr\"></strong><p class=\"countdown-note hidden\"></p></div><h2 dir=\"auto\" id=\"trainerTitle\"></h2><div class=\"invite\"><div><span class=\"eyebrow\"><span data-i18n=\"كود دخول المتدربين\">كود دخول المتدربين</span></span><div class=\"code\" id=\"sessionCode\"></div><p class=\"muted\"><span data-i18n=\"امسح الـ QR أو افتح الرابط واكتب الكود.\">امسح الـ QR أو افتح الرابط واكتب الكود.</span></p><div class=\"actions\"><button class=\"secondary\" id=\"copyJoin\"><span data-i18n=\"انسخ رابط المتدربين\">انسخ رابط المتدربين</span></button><a class=\"btn secondary\" id=\"openJoin\" rel=\"noopener\" target=\"_blank\"><span data-i18n=\"افتح كمتدرب\">افتح كمتدرب</span></a></div><a class=\"url\" id=\"joinUrl\" rel=\"noopener\" target=\"_blank\"></a></div><figure class=\"qrbox\"><a id=\"qrLink\" rel=\"noopener\" target=\"_blank\"><img alt=\"QR لدخول السيشن على جهاز المتدرب\" data-i18n-alt=\"QR لدخول السيشن على جهاز المتدرب\" height=\"208\" id=\"qr\" width=\"208\"/></a><figcaption><span data-i18n=\"امسح الرمز بالموبايل للمشاركة\">امسح الرمز بالموبايل للمشاركة</span></figcaption></figure></div><section class=\"card\"><span class=\"eyebrow\" id=\"pollStatus\"></span><h2 dir=\"auto\" id=\"resultQuestion\"></h2><div class=\"metric\"><strong id=\"total\">0</strong><span><span data-i18n=\"ردود حقيقية\">ردود حقيقية</span></span></div><p class=\"muted\" id=\"empty\"><span data-i18n=\"لسه مفيش ردود. اعرض الكود أو الـ QR للقاعة.\">لسه مفيش ردود. اعرض الكود أو الـ QR للقاعة.</span></p><div class=\"results\" id=\"results\"></div><section class=\"hidden\" id=\"rankingResults\"><h3><span data-i18n=\"ترتيب السؤال\">ترتيب السؤال</span></h3><p class=\"muted\" id=\"rankingHint\"></p><div id=\"rankingList\"></div><p class=\"muted\"><span data-i18n=\"وقت الوصول للسيرفر من فتح السؤال\">وقت الوصول للسيرفر من فتح السؤال</span></p><div class=\"actions\"><button class=\"secondary\" id=\"nextRanking\"><span data-i18n=\"السؤال التالي في نفس الجولة\">السؤال التالي في نفس الجولة</span></button><button id=\"finishRanking\"><span data-i18n=\"إنهاء الجولة وعرض السكور\">إنهاء الجولة وعرض السكور</span></button></div><section class=\"hidden card\" id=\"roundResults\"><h3><span data-i18n=\"السكور النهائي للجولة\">السكور النهائي للجولة</span></h3><div id=\"roundList\"></div></section></section><section class=\"card hidden\" id=\"namedPollSection\"><h3><span data-i18n=\"مين اختار إيه؟\">مين اختار إيه؟</span></h3><div class=\"results\" id=\"namedPollAnswers\"></div></section><div class=\"actions\"><button class=\"secondary\" id=\"toggle\"><span data-i18n=\"اقفل التصويت\">اقفل التصويت</span></button><button class=\"secondary\" id=\"newSession\"><span data-i18n=\"سيشن جديد\">سيشن جديد</span></button></div><div class=\"notice hidden\" id=\"newConfirm\"><p><span data-i18n=\"هتقفل التصويت الحالي وتبدأ سؤال جديد. النتايج الحالية هتفضل متاحة لحد انتهاء السيشن.\">هتقفل التصويت الحالي وتبدأ سؤال جديد. النتايج الحالية هتفضل متاحة لحد انتهاء السيشن.</span></p><div class=\"actions\"><button id=\"confirmNew\"><span data-i18n=\"اقفل وابدأ جديد\">اقفل وابدأ جديد</span></button><button class=\"secondary\" id=\"cancelNew\"><span data-i18n=\"إلغاء\">إلغاء</span></button></div></div><div class=\"notice\" data-normal-only=\"true\"><strong><span data-i18n=\"حوّل التصويت لنقاش\">حوّل التصويت لنقاش</span></strong><p><span data-i18n=\"إيه اللي يخليك تختار الرد ده؟ وإيه المعلومة الناقصة قبل ما ترد على العميل؟ مفيش تصحيح آلي أو ترتيب للمتدربين.\">إيه اللي يخليك تختار الرد ده؟ وإيه المعلومة الناقصة قبل ما ترد على العميل؟ مفيش تصحيح آلي أو ترتيب للمتدربين.</span></p></div><p class=\"muted\"><span data-i18n=\"تحديث الصفحة آمن، لكن قفل التبويب أو تغيير المتصفح ممكن يضيّع صلاحية التحكم. رابط المتدربين ما بيدّيش صلاحية التحكم. بيانات السيشن بتصبح غير متاحة بعد ٢٤ ساعة وتُحذف عند التنظيف التالي.\">تحديث الصفحة آمن، لكن قفل التبويب أو تغيير المتصفح ممكن يضيّع صلاحية التحكم. رابط المتدربين ما بيدّيش صلاحية التحكم. بيانات السيشن بتصبح غير متاحة بعد ٢٤ ساعة وتُحذف عند التنظيف التالي.</span></p></section></section>\n<section class=\"hidden\" id=\"join\"><span class=\"eyebrow\"><span data-i18n=\"شارك في النشاط\">شارك في النشاط</span></span><h2><span data-i18n=\"جاهز تشارك؟\">جاهز تشارك؟</span></h2><p><span data-i18n=\"اكتب الكود الظاهر في شاشة المدرب.\">اكتب الكود الظاهر في شاشة المدرب.</span></p><label for=\"joinCode\"><span data-i18n=\"كود السيشن\">كود السيشن</span></label><input autocomplete=\"off\" class=\"joincode\" id=\"joinCode\" inputmode=\"numeric\" maxlength=\"6\" placeholder=\"000000\"/><div class=\"actions\"><button id=\"joinButton\"><span data-i18n=\"ادخل النشاط\">ادخل النشاط</span></button></div></section>\n<section class=\"hidden\" id=\"participant\"><div class=\"status\" id=\"participantConnection\" role=\"status\"></div><div aria-live=\"off\" class=\"countdown hidden\" id=\"participantCountdown\" role=\"timer\"><span class=\"countdown-label\"></span><strong class=\"countdown-value\" dir=\"ltr\"></strong><p class=\"countdown-note hidden\"></p></div><span class=\"eyebrow\" id=\"answerType\"><span data-i18n=\"تصويت سريع · اختيار واحد\">تصويت سريع · اختيار واحد</span></span><div class=\"notice hidden\" id=\"rankingParticipantInfo\"><p><span data-i18n=\"ترتيبك بيظهر للمدرب بعد قفل السؤال. استخدم نفس المتصفح طول الجولة.\">ترتيبك بيظهر للمدرب بعد قفل السؤال. استخدم نفس المتصفح طول الجولة.</span></p><p id=\"rankingParticipantRule\"></p></div><h2 dir=\"auto\" id=\"participantTitle\"></h2><h3 dir=\"auto\" id=\"participantQuestion\"></h3><div class=\"notice hidden\" id=\"nameEntry\"><label for=\"participantName\"><span data-i18n=\"اسمك اللي هيظهر للمدرب\">اسمك اللي هيظهر للمدرب</span></label><input autocomplete=\"off\" data-i18n-placeholder=\"اكتب اسمك\" dir=\"auto\" id=\"participantName\" maxlength=\"200\" placeholder=\"اكتب اسمك\"/><p><span data-i18n=\"السيشن دي بالأسماء. اسمك وإجابتك هيظهروا للمدرب، وممكن يعرض شاشته للقاعة. اكتب الاسم اللي تحب تظهر بيه فقط، من غير أي بيانات إضافية.\">السيشن دي بالأسماء. اسمك وإجابتك هيظهروا للمدرب، وممكن يعرض شاشته للقاعة. اكتب الاسم اللي تحب تظهر بيه فقط، من غير أي بيانات إضافية.</span></p></div><div class=\"choices\" id=\"choices\"></div><div class=\"hidden\" id=\"textEntry\"><label for=\"writtenAnswer\"><span data-i18n=\"إجابتك\">إجابتك</span></label><textarea data-i18n-placeholder=\"اكتب فكرتك هنا، من غير أسماء أو بيانات شخصية…\" dir=\"auto\" id=\"writtenAnswer\" maxlength=\"500\" placeholder=\"اكتب فكرتك هنا، من غير أسماء أو بيانات شخصية…\"></textarea><div class=\"muted\"><span id=\"charCount\">0</span><span data-i18n=\" / 500 حرف\"> / 500 حرف</span></div><div class=\"notice\"><span id=\"textPrivacy\"><span data-i18n=\"ردك من غير اسم، وبيوصل للمدرب فقط.\">ردك من غير اسم، وبيوصل للمدرب فقط.</span></span><span data-i18n=\" ممكن المدرب يعرض شاشته للقاعة، فما تكتبش أي بيانات شخصية أو بيانات عملاء.\"> ممكن المدرب يعرض شاشته للقاعة، فما تكتبش أي بيانات شخصية أو بيانات عملاء.</span></div></div><div class=\"notice hidden\" id=\"voteStatus\" role=\"status\"></div><div class=\"actions\"><button disabled=\"\" id=\"vote\"><span data-i18n=\"ثبّت إجابتي\">ثبّت إجابتي</span></button><a class=\"btn secondary\" href=\"/join\"><span data-i18n=\"ادخل سيشن تاني\">ادخل سيشن تاني</span></a></div><p class=\"muted\" data-normal-only=\"true\"><span data-i18n=\"إجابة واحدة لكل متصفح في السيشن. دي وسيلة للنقاش مش نظام امتحانات، وممكن التصويت من متصفح تاني. ما تكتبش أي بيانات شخصية.\">إجابة واحدة لكل متصفح في السيشن. دي وسيلة للنقاش مش نظام امتحانات، وممكن التصويت من متصفح تاني. ما تكتبش أي بيانات شخصية.</span></p></section>\n<section class=\"hidden\" id=\"wheel\"><h2><span data-i18n=\"لف واختار\">لف واختار</span></h2><p><span data-i18n=\"اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.\">اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.</span></p><div class=\"wheel-layout\"><div class=\"wheel-editor\"><label for=\"wheelEntries\"><span data-i18n=\"العناصر\">العناصر</span></label><p class=\"muted\"><span data-i18n=\"كل اسم أو رقم أو عنصر في سطر منفصل.\">كل اسم أو رقم أو عنصر في سطر منفصل.</span></p><textarea data-i18n-placeholder=\"أسماء، أرقام، أفكار… كل عنصر في سطر\" dir=\"auto\" id=\"wheelEntries\" maxlength=\"25000\" placeholder=\"أسماء، أرقام، أفكار… كل عنصر في سطر\" rows=\"10\" spellcheck=\"false\"></textarea><p class=\"muted\" id=\"wheelCount\"></p><button class=\"secondary\" id=\"wheelClear\" type=\"button\"><span data-i18n=\"مسح العناصر\">مسح العناصر</span></button></div><div class=\"wheel-stage\"><canvas aria-label=\"عجلة اختيار عشوائي\" height=\"720\" id=\"wheelCanvas\" role=\"img\" width=\"720\"></canvas><button disabled=\"\" id=\"wheelSpin\" type=\"button\"><span data-i18n=\"لف العجلة\">لف العجلة</span></button><section aria-atomic=\"true\" aria-live=\"polite\" class=\"wheel-result hidden\" id=\"wheelResult\"><p><span data-i18n=\"الاختيار وقع على\">الاختيار وقع على</span></p><strong dir=\"auto\" id=\"wheelWinner\"></strong></section></div></div><div class=\"notice\"><p><span data-i18n=\"كل سطر له نفس فرصة الاختيار. تكرار نفس العنصر يزود فرصته. الفائز يفضل موجود للفة اللي بعدها.\">كل سطر له نفس فرصة الاختيار. تكرار نفس العنصر يزود فرصته. الفائز يفضل موجود للفة اللي بعدها.</span></p><p><span data-i18n=\"من ٢ إلى ٢٠٠ عنصر، وكل عنصر لحد ١٠٠ حرف. مع القوائم الكبيرة تظهر الألوان على العجلة والنتيجة كاملة تحتها.\">من ٢ إلى ٢٠٠ عنصر، وكل عنصر لحد ١٠٠ حرف. مع القوائم الكبيرة تظهر الألوان على العجلة والنتيجة كاملة تحتها.</span></p><p><span data-i18n=\"العناصر موجودة في الصفحة دي فقط، مش بتتبعت للسيرفر ومش بتتحفظ بعد الريفريش.\">العناصر موجودة في الصفحة دي فقط، مش بتتبعت للسيرفر ومش بتتحفظ بعد الريفريش.</span></p><p><span data-i18n=\"اختيار عشوائي للأنشطة والجوائز البسيطة، مش سحب معتمد أو لعبة بفلوس.\">اختيار عشوائي للأنشطة والجوائز البسيطة، مش سحب معتمد أو لعبة بفلوس.</span></p></div></section><footer><span data-i18n=\"نسخة أولية مجانية · تحتاج اتصالاً بالإنترنت · من غير ردود محاكاة · الردود والأسئلة محفوظة مؤقتاً على Cloudflare\">نسخة أولية مجانية · تحتاج اتصالاً بالإنترنت · من غير ردود محاكاة · الردود والأسئلة محفوظة مؤقتاً على Cloudflare</span></footer></main><script>\nconst EN={\"نشاط سريع · ردود حقيقية من كل جهاز\": \"Quick activity · Real replies from every device\", \"البداية\": \"Home\", \"سؤال واحد، كود واحد، ونقاش يشارك فيه الكل. بالاسم أو من غيره، ومن غير تسجيل حساب.\": \"One question. One code. Everyone joins the conversation. Named or anonymous, with no account needed.\", \"للمدرب\": \"FOR TRAINERS\", \"اسمع رأي القاعة\": \"Hear from everyone\", \"اكتب سؤالك، اعرض الـ QR، وشوف الردود بتوصل من أجهزة المتدربين.\": \"Write a question, share the QR code and watch replies arrive from participants' devices.\", \"جهّز سؤال\": \"Prepare a question\", \"للمتدرب\": \"FOR PARTICIPANTS\", \"جاهز تشارك؟\": \"Ready to join?\", \"معاك كود من المدرب؟ ادخل النشاط واختار إجابتك.\": \"Have a code from your trainer? Join the activity and share your answer.\", \"ادخل بكود السيشن\": \"Join with a session code\", \"للمدرب · القسم الثالث\": \"FOR TRAINERS · QUESTION BANK\", \"بنك أسئلة جاهزة\": \"A question to get things going\", \"٥٠ سؤال خفيف في ٥ أقسام. اختار سؤال وعدّله براحتك قبل ما تبدأ.\": \"50 light-hearted questions in 5 categories. Pick one and make it your own before you start.\", \"اختار من بنك الأسئلة\": \"Browse the question bank\", \"عندك سيشن مفتوح على المتصفح ده.\": \"You have a session saved in this browser tab.\", \"ارجع لشاشة المدرب\": \"Return to trainer view\", \"نسخة أولية لايف\": \"Live pilot\", \"تحتاج إنترنت على كل جهاز. التحديث كل ٥ ثوانٍ. استخدم أسئلة تجريبية فقط، من غير بيانات عملاء أو معلومات حساسة.\": \"Every device needs internet. Updates arrive every 5 seconds. Use test questions only, without customer data or sensitive information.\", \"من غير ما تنقل محتواك\": \"NO NEED TO REBUILD YOUR TRAINING\", \"جهّز سؤال واحد\": \"Prepare one question\", \"اختار من بنك الأسئلة · ٥٠ سؤال\": \"Browse the question bank · 50 questions\", \"اختيار السؤال بيملأ الحقول بس، مش بيبدأ السيشن. راجع وعدّل قبل النشر.\": \"Picking a question only fills the fields. It does not start a session. Review and edit before going live.\", \"هوية المشاركين\": \"Participant identity\", \"من غير أسماء\": \"Anonymous\", \"بالأسماء\": \"Named\", \"هتشوف الردود من غير أسماء، زي الوضع الحالي.\": \"Replies will appear without participant names.\", \"نوع الإجابة\": \"Answer type\", \"اختيارات\": \"Multiple choice\", \"إجابة مكتوبة\": \"Written answer\", \"المتدرب يختار إجابة واحدة من ٣ اختيارات.\": \"Participants select one of three options.\", \"عنوان السيشن\": \"Session title\", \"سؤال النقاش\": \"Discussion question\", \"الاختيار ١\": \"Option 1\", \"الاختيار ٢\": \"Option 2\", \"الاختيار ٣\": \"Option 3\", \"افتح السيشن اللايف\": \"Start live session\", \"رجوع\": \"Back\", \"خيارين\": \"Two options\", \"٣ اختيارات\": \"Three options\", \"كل سيشن سؤال واحد، باختيارات أو إجابة مكتوبة، وصلاحيته ٢٤ ساعة. مش اختبار معتمد ولا تقييم جاهزية للعمل.\": \"Each session has one question, with multiple-choice or written answers, and lasts 24 hours. This is not a certified exam or a work-readiness assessment.\", \"جاري الاتصال…\": \"Connecting…\", \"كود دخول المتدربين\": \"PARTICIPANT JOIN CODE\", \"امسح الـ QR أو افتح الرابط واكتب الكود.\": \"Scan the QR code, or open the link and enter the code.\", \"انسخ رابط المتدربين\": \"Copy participant link\", \"افتح كمتدرب\": \"Open participant view\", \"امسح الرمز بالموبايل للمشاركة\": \"Scan with your phone to join\", \"ردود حقيقية\": \"Real replies\", \"لسه مفيش ردود. اعرض الكود أو الـ QR للقاعة.\": \"No replies yet. Share the code or QR with the room.\", \"مين اختار إيه؟\": \"Who chose what?\", \"اقفل التصويت\": \"Close voting\", \"سيشن جديد\": \"New session\", \"هتقفل التصويت الحالي وتبدأ سؤال جديد. النتايج الحالية هتفضل متاحة لحد انتهاء السيشن.\": \"This closes the current session to replies and prepares a new question. Current results stay available until the session expires.\", \"اقفل وابدأ جديد\": \"Close and start new\", \"إلغاء\": \"Cancel\", \"حوّل التصويت لنقاش\": \"Turn replies into a discussion\", \"إيه اللي يخليك تختار الرد ده؟ وإيه المعلومة الناقصة قبل ما ترد على العميل؟ مفيش تصحيح آلي أو ترتيب للمتدربين.\": \"What made you choose that answer? What else would you want to know? There is no automatic marking or participant ranking.\", \"تحديث الصفحة آمن، لكن قفل التبويب أو تغيير المتصفح ممكن يضيّع صلاحية التحكم. رابط المتدربين ما بيدّيش صلاحية التحكم. بيانات السيشن بتصبح غير متاحة بعد ٢٤ ساعة وتُحذف عند التنظيف التالي.\": \"Refreshing this tab is safe. Closing the tab or switching browsers may lose trainer control. Participant links do not grant control. Sessions become unavailable after 24 hours and are deleted during the next cleanup.\", \"شارك في النشاط\": \"JOIN THE ACTIVITY\", \"اكتب الكود الظاهر في شاشة المدرب.\": \"Enter the code shown on your trainer's screen.\", \"كود السيشن\": \"Session code\", \"ادخل النشاط\": \"Join activity\", \"تصويت سريع · اختيار واحد\": \"QUICK POLL · CHOOSE ONE\", \"اسمك اللي هيظهر للمدرب\": \"Your display name for the trainer\", \"السيشن دي بالأسماء. اسمك وإجابتك هيظهروا للمدرب، وممكن يعرض شاشته للقاعة. اكتب الاسم اللي تحب تظهر بيه فقط، من غير أي بيانات إضافية.\": \"This is a named session. The trainer sees your name and answer and may project the results. Enter only the name or nickname you want displayed, without any other personal details.\", \"إجابتك\": \"Your answer\", \" / 500 حرف\": \" / 500 characters\", \"ردك من غير اسم، وبيوصل للمدرب فقط.\": \"Your reply is anonymous and is sent only to the trainer.\", \" ممكن المدرب يعرض شاشته للقاعة، فما تكتبش أي بيانات شخصية أو بيانات عملاء.\": \" The trainer may project the screen. Do not include personal information or customer data.\", \"ثبّت إجابتي\": \"Submit my answer\", \"ادخل سيشن تاني\": \"Join another session\", \"إجابة واحدة لكل متصفح في السيشن. دي وسيلة للنقاش مش نظام امتحانات، وممكن التصويت من متصفح تاني. ما تكتبش أي بيانات شخصية.\": \"One reply per browser in each session. This is a discussion tool, not an exam system. Another browser can submit again. Do not include personal information.\", \"نسخة أولية مجانية · تحتاج اتصالاً بالإنترنت · من غير ردود محاكاة · الردود والأسئلة محفوظة مؤقتاً على Cloudflare\": \"Free pilot · Internet required · No simulated replies · Questions and replies are stored temporarily on Cloudflare\", \"أقسام بنك الأسئلة\": \"Question bank categories\", \"QR لدخول السيشن على جهاز المتدرب\": \"Scan this QR code to join on a participant device\", \"اكتب اسمك\": \"Enter your name or nickname\", \"اكتب فكرتك هنا، من غير أسماء أو بيانات شخصية…\": \"Share your thoughts, without names or personal information…\", \"التعامل مع عميل غاضب\": \"Handling an upset customer\", \"عميل متضايق لأن طلبه اتأخر. تبدأ بإيه؟\": \"A customer is upset about a delayed order. How do you start?\", \"أشرح سياسة الشركة فوراً\": \"Explain company policy right away\", \"أسمع المشكلة وأتأكد إني فاهمها\": \"Listen and check that I understand the problem\", \"أحوّله لقسم تاني من غير توضيح\": \"Transfer them without explaining\", \"حصل خطأ. جرّب تاني.\": \"Something went wrong. Please try again.\", \"تعذّر الاتصال بالخدمة. اتأكد من الإنترنت وجرّب تاني.\": \"Could not connect. Check your internet and try again.\", \"تعذّر تنفيذ الطلب.\": \"Could not complete the request.\", \"كل مشارك هيكتب اسمه، وهتشوف اسمه جنب إجابته. قول للقاعة قبل المشاركة.\": \"Each participant enters a name, shown beside their answer. Tell the room before they join.\", \"المتدرب يختار إجابة واحدة من خيارين.\": \"Participants select one of two options.\", \"المتدرب يكتب رد واحد لحد ٥٠٠ حرف. ظهور الاسم حسب وضع الهوية اللي اخترته فوق.\": \"Participants write one reply of up to 500 characters. Names follow the identity mode selected above.\", \" · ١٠ أسئلة\": \" · 10 questions\", \"مكتوبة\": \"Written\", \"اتختار السؤال \": \"Selected question \", \". راجع الحقول وعدّل قبل ما تبدأ.\": \". Review and edit the fields before you start.\", \"كمّل عنوان السيشن والسؤال وكل الاختيارات.\": \"Complete the session title, question and all options.\", \"استقبال الردود مفتوح\": \"Replies are open\", \"التصويت مفتوح\": \"Voting is open\", \"استقبال الردود مقفول\": \"Replies are closed\", \"التصويت مقفول\": \"Voting is closed\", \"اقفل الردود\": \"Close replies\", \"افتح الردود\": \"Open replies\", \"افتح التصويت\": \"Open voting\", \"مشارك\": \"Participant\", \"رد \": \"Reply \", \"متصل · آخر تحديث \": \"Connected · Last updated \", \"التحديث متوقف مؤقتاً، بنحاول تاني\": \"Updates paused. Retrying…\", \"اتنسخ الرابط\": \"Link copied\", \"انسخ الرابط المكتوب تحت الزر\": \"Copy the link below this button\", \"اكتب كود السيشن المكوّن من ٦ أرقام.\": \"Enter the 6-digit session code.\", \"ردك واسمك بيوصلوا للمدرب فقط.\": \"Your name and reply are sent only to the trainer.\", \"سؤال مفتوح · إجابة مكتوبة\": \"OPEN QUESTION · WRITTEN ANSWER\", \"ابعث إجابتي\": \"Send my answer\", \"اتسجّل ردك ووصل للمدرب. شكراً لمشاركتك.\": \"Your reply reached the trainer. Thanks for taking part.\", \"المدرب قفل استقبال الردود. لو فتحه تاني هتقدر تشارك.\": \"The trainer has closed replies. You can join in if they reopen them.\", \"متصل · استقبال الردود مفتوح\": \"Connected · Replies are open\", \"متصل · استقبال الردود مقفول\": \"Connected · Replies are closed\", \"تعذّر تحديث حالة السيشن\": \"Could not update the session status\", \"حجم الطلب أكبر من المسموح.\": \"The request is too large.\", \"بيانات الطلب غير صحيحة.\": \"The request data is invalid.\", \"كمّل السؤال والاختيارات، والتزم بالطول المسموح.\": \"Complete the question and options within the length limits.\", \"كود غير صحيح.\": \"Invalid code.\", \"الخدمة قيد التجهيز. جرّب بعد قليل.\": \"The service is getting ready. Try again shortly.\", \"مطلوب خيارين أو ٣ اختيارات.\": \"Provide two or three options.\", \"وصلنا للحد التجريبي اليومي. جرّب لاحقاً.\": \"The pilot session limit has been reached. Try again later.\", \"تعذّر إنشاء كود جديد. جرّب تاني.\": \"Could not create a new code. Please try again.\", \"الرابط مش موجود.\": \"This link does not exist.\", \"مفيش سيشن بالكود ده. اتأكد من الكود.\": \"No session was found. Check the code.\", \"الكود غير صحيح أو السيشن انتهى. اتأكد من المدرب.\": \"The code is invalid or the session has expired. Check with the trainer.\", \"بيانات المتصفح غير صحيحة.\": \"Invalid browser data.\", \"اكتب الاسم اللي تحب تظهر بيه، لحد ٢٠٠ حرف.\": \"Enter a display name, up to 200 characters.\", \"المدرب قفل استقبال الردود.\": \"The trainer has closed replies.\", \"المدرب قفل الردود.\": \"The trainer has closed replies.\", \"استقبال الردود مقفول أو وصل للحد التجريبي.\": \"Replies are closed or the pilot reply limit has been reached.\", \"اختار إجابة صحيحة.\": \"Choose a valid option.\", \"المدرب قفل التصويت.\": \"The trainer has closed voting.\", \"التصويت مقفول أو وصل للحد التجريبي.\": \"Voting is closed or the pilot reply limit has been reached.\", \"شاشة المدرب دي مش متاحة من المتصفح الحالي.\": \"Trainer access is not available in this browser tab.\", \"حالة التصويت غير صحيحة.\": \"Invalid voting status.\", \"الطلب غير مسموح.\": \"This request is not allowed.\", \"تعذّر الاتصال بالخدمة. جرّب تاني بعد قليل.\": \"Could not connect to the service. Try again shortly.\", \"مؤقت السؤال\": \"Question timer\", \"من غير مؤقت\": \"No timer\", \"بمؤقت\": \"Timed\", \"المدة\": \"Duration\", \"دقائق\": \"Minutes\", \"ثواني\": \"Seconds\", \"المؤقت اختياري. بيبدأ لما تفتح السيشن، وبيقفل استقبال الردود تلقائياً عند الصفر.\": \"The timer is optional. It starts when you open the live session and closes replies automatically at zero.\", \"قفل وفتح الردود مش بيوقف أو يعيد المؤقت. بعد الصفر ابدأ سيشن جديد لو عايز تكمل.\": \"Closing and reopening replies does not pause or reset the timer. After zero, start a new session to continue.\", \"الوقت المتبقي\": \"Time remaining\", \"الوقت خلص\": \"Time is up\", \"الوقت خلص. استقبال الردود اتقفل تلقائياً.\": \"Time is up. Replies closed automatically.\", \"الوقت خلص. ابدأ سيشن جديد لو عايز تكمل.\": \"Time is up. Start a new session to continue.\", \"اختار مدة صحيحة من ثانية لحد ٢٣ ساعة و٥٩ دقيقة و٥٩ ثانية، أو اقفل المؤقت.\": \"Choose a duration from 1 second to 23 hours, 59 minutes and 59 seconds, or turn the timer off.\", \"اكتب الدقائق من ٠ لحد ١٤٣٩ والثواني من ٠ لحد ٥٩. المدة لازم تكون ثانية على الأقل.\": \"Enter 0–1439 minutes and 0–59 seconds, with a total duration of at least 1 second.\", \"الوضع الداكن\": \"Dark mode\", \"الوضع الفاتح\": \"Light mode\", \"تغيير المظهر\": \"Change appearance\"};\nObject.assign(EN,{\"اكتب عنوان السيشن\": \"Enter a session title\", \"اكتب سؤالك هنا\": \"Write your question here\", \"اكتب الاختيار الأول\": \"Enter the first option\", \"اكتب الاختيار الثاني\": \"Enter the second option\", \"اكتب الاختيار الثالث\": \"Enter the third option\"});\nObject.assign(EN,{\"رانكينج\": \"Ranking\", \"إعدادات الرانكينج\": \"Ranking settings\", \"في إجابة صح؟\": \"Does this question have a correct answer?\", \"من غير إجابة صح\": \"No correct answer\", \"في إجابة صح\": \"Has a correct answer\", \"اختار الإجابة الصحيحة\": \"Choose the correct option\", \"الاختيار الأول\": \"First option\", \"الاختيار الثاني\": \"Second option\", \"الاختيار الثالث\": \"Third option\", \"الرانكينج باختيارات. الأسرع حسب وقت وصول الرد للسيرفر من فتح السؤال، فسرعة الإنترنت بتأثر. مع الإجابة الصحيحة، الردود الصح بس تدخل الترتيب.\": \"Ranking uses selectable options. Speed is measured from question opening to server receipt, so network speed affects the result. With a correct option, only correct answers are ranked.\", \"النقاط لكل سؤال: ١٠٠٠ ÷ المركز، مقربة لأسفل وبحد أدنى نقطة. التعادل في الوقت ياخد نفس المركز والنقاط.\": \"Points per question: 1000 ÷ place, rounded down, minimum 1 point. Equal times share a place and points.\", \"ترتيب السؤال\": \"Question ranking\", \"اقفل الردود أو استنى المؤقت يخلص عشان يظهر ترتيب السؤال.\": \"Close replies or wait for the timer to see the question ranking.\", \"مفيش إجابات مؤهلة للترتيب لسه.\": \"No eligible answers to rank.\", \"السكور النهائي للجولة\": \"Final round scores\", \"السؤال التالي في نفس الجولة\": \"Next question in this round\", \"إنهاء الجولة وعرض السكور\": \"End round and show scores\", \"إنهاء الجولة يقفل كل أسئلتها نهائياً. متأكد؟\": \"Ending the round permanently closes all its questions. Continue?\", \"نقطة\": \"points\", \"ثانية\": \"seconds\", \"مشارك \": \"Participant \", \"إجابات مؤهلة\": \"eligible answers\", \"جولة رانكينج مستمرة. خلي المشاركين يدخلوا كل سؤال من نفس المتصفح عشان السكور يتجمع. لكل سؤال كود وQR جديد.\": \"Continuing a ranking round. Participants must use the same browser for every question to combine scores. Each question has a new code and QR.\", \"ابدأ جولة منفصلة بدل دي\": \"Start a separate round instead\", \"رانكينج · أسرع إجابة\": \"Ranking · Fastest answer\", \"رانكينج · أسرع إجابة صحيحة\": \"Ranking · Fastest correct answer\", \"ترتيبك بيظهر للمدرب بعد قفل السؤال. استخدم نفس المتصفح طول الجولة.\": \"The trainer sees rankings after the question closes. Use the same browser throughout the round.\", \"الجولة انتهت. ابدأ جولة جديدة.\": \"This round has ended. Start a new round.\", \"اختار الإجابة الصحيحة من الاختيارات.\": \"Choose a correct option from the available options.\", \"خلي وضع الأسماء ثابت في نفس الجولة.\": \"Keep the same name setting for this round.\", \"الجولة وصلت ٥٠ سؤال. ابدأ جولة جديدة.\": \"This round has reached 50 questions. Start a new round.\", \"الجولة دي مش متاحة من المتصفح الحالي.\": \"This round is not available in this browser.\", \"جولة غير صحيحة.\": \"Invalid round.\", \"كل سؤال ليه كود جديد. استخدموا نفس المتصفح لكل الأسئلة. النتايج مؤقتة لمدة ٢٤ ساعة، زي باقي الأوضاع.\": \"Each question has a new code. Use the same browser for every question. Results are temporary for 24 hours, like the other modes.\", \"جولة جديدة\": \"New round\", \"المركز\": \"Place\", \"المشارك\": \"Participant\", \"الوقت\": \"Time\", \"النقاط\": \"Points\", \"وقت الوصول للسيرفر من فتح السؤال\": \"Server receipt time from question opening\", \"الهوية في الجولة\": \"Identity in this round\", \"الإجابات غير الصحيحة لا تأخذ نقاط.\": \"Incorrect answers receive no points.\", \"الجولة خلصت. السكور النهائي ظاهر تحت.\": \"Round ended. Final scores are shown below.\"});\nObject.assign(EN,{\"العجلة\": \"Wheel\", \"الأنشطة\": \"Activities\", \"لف واختار\": \"Spin and pick\", \"اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.\": \"Pick randomly from names, numbers or any entries you write.\", \"العناصر\": \"Entries\", \"كل اسم أو رقم أو عنصر في سطر منفصل.\": \"One name, number or entry per line.\", \"أسماء، أرقام، أفكار… كل عنصر في سطر\": \"Names, numbers, ideas… one entry per line\", \"لف العجلة\": \"Spin the wheel\", \"بتلف…\": \"Spinning…\", \"مسح العناصر\": \"Clear entries\", \"تمسح كل عناصر العجلة؟\": \"Clear every wheel entry?\", \"الاختيار وقع على\": \"The wheel picked\", \"عنصر\": \"entries\", \"أضف العناصر\": \"Add entries\", \"عجلة اختيار عشوائي\": \"Random picker wheel\", \"اكتب عنصرين على الأقل، كل عنصر في سطر.\": \"Enter at least two entries, one per line.\", \"الحد الأقصى ٢٠٠ عنصر في اللفة.\": \"A spin supports up to 200 entries.\", \"كل عنصر لحد ١٠٠ حرف.\": \"Each entry can have up to 100 characters.\", \"كل سطر له نفس فرصة الاختيار. تكرار نفس العنصر يزود فرصته. الفائز يفضل موجود للفة اللي بعدها.\": \"Each line has an equal chance. Repeated entries increase their chance. The winner stays in the list for the next spin.\", \"من ٢ إلى ٢٠٠ عنصر، وكل عنصر لحد ١٠٠ حرف. مع القوائم الكبيرة تظهر الألوان على العجلة والنتيجة كاملة تحتها.\": \"Use 2 to 200 entries, up to 100 characters each. Large lists show colored segments and the full result below.\", \"العناصر موجودة في الصفحة دي فقط، مش بتتبعت للسيرفر ومش بتتحفظ بعد الريفريش.\": \"Entries stay on this page only. They are not sent to the server and are not kept after a refresh.\", \"اختيار عشوائي للأنشطة والجوائز البسيطة، مش سحب معتمد أو لعبة بفلوس.\": \"Random picking for activities and small prizes, not a certified draw or a money game.\"});\nlet lang='ar';try{lang=new URLSearchParams(location.search).get('lang')||localStorage.getItem('roompulse.language')||'ar'}catch{}if(!['ar','en'].includes(lang))lang='ar';\nconst t=s=>lang==='en'?(EN[s]??s):s;\nfunction localBank(x){return lang==='en'?{...x,...x.en}:x}\nfunction applyLanguage(){applyTheme();renderWheelLanguage();document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));for(const a of ['placeholder','alt','aria-label'])document.querySelectorAll('[data-i18n-'+a+']').forEach(e=>e.setAttribute(a,t(e.getAttribute('data-i18n-'+a))));document.querySelectorAll('[data-default-ar]').forEach(e=>{if([e.dataset.defaultAr,e.dataset.defaultEn].includes(e.value))e.value=lang==='en'?e.dataset.defaultEn:e.dataset.defaultAr});$('langAR').setAttribute('aria-pressed',String(lang==='ar'));$('langEN').setAttribute('aria-pressed',String(lang==='en'));document.querySelectorAll('a').forEach(e=>{if(!e.dataset.route&&['/','/join'].includes(e.getAttribute('href')))e.dataset.route=e.getAttribute('href');if(e.dataset.route)e.href=(e.dataset.route==='/join'?joinPath:appBase)+'?lang='+lang})}\nfunction setLanguage(v){lang=v;try{localStorage.setItem('roompulse.language',v)}catch{}const u=new URL(location);u.searchParams.set('lang',lang);history.replaceState(null,'',u);applyLanguage();renderBank();setIdentity(identity);setMode(mode);updateCountdown();$('copyJoin').textContent=t('انسخ رابط المتدربين');if($('bankSelected').dataset.questionId)$('bankSelected').textContent=t('اتختار السؤال ')+$('bankSelected').dataset.questionId+t('. راجع الحقول وعدّل قبل ما تبدأ.');if(lastError)$('globalError').textContent=t(lastError);if(role==='participant'&&current)renderParticipant();if(role==='trainer'&&current){renderRanking(current);const u=location.origin+joinPath+'?code='+current.code+'&lang='+lang;for(const id of ['joinUrl','openJoin','qrLink'])$(id).href=u;$('joinUrl').textContent=u;$('qr').src=apiOrigin+'/qr?code='+current.code+'&lang='+lang+(pagesHost?'&frontend=pages':'');refreshTrainer()}}\n\nlet lastError='';const $=id=>document.getElementById(id);let current=null,selected=-1,timer=null,role='',sending=false,mode='poll',optionCount=3,identity='anonymous';\nconst esc=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nfunction show(id){for(const n of ['welcome','setup','trainer','join','participant','wheel'])$(n).classList.toggle('hidden',n!==id);role=id;$('activitiesTab').setAttribute('aria-pressed',String(id!=='wheel'));$('wheelTab').setAttribute('aria-pressed',String(id==='wheel'));document.querySelector('.section-tabs').classList.toggle('hidden',id==='join'||id==='participant');updateCountdown();$('globalError').textContent='';lastError='';clearInterval(timer);timer=null;window.scrollTo(0,0)}\nfunction error(e){lastError=Object.keys(EN).find(k=>EN[k]===e.message)||e.message;$('globalError').textContent=t(lastError)||t(\"حصل خطأ. جرّب تاني.\")}\nfunction saved(){try{return JSON.parse(sessionStorage.getItem('hall.trainer')||'null')}catch{return null}}\nfunction save(v){try{sessionStorage.setItem('hall.trainer',JSON.stringify(v))}catch{}}\nfunction client(){try{let v=localStorage.getItem('hall.device');if(!v){v=crypto.randomUUID();localStorage.setItem('hall.device',v)}return v}catch{return memoryClient}}\nconst memoryClient=crypto.randomUUID();\nconst pagesHost=location.origin==='https://omarnagycd.github.io';const apiOrigin=pagesHost?'https://roompulse.s21smk.workers.dev':'';const appBase=pagesHost?'/RoomPulse/':'/';const joinPath=pagesHost?appBase+'join/':'/join';\nasync function api(path,body,token){const r=await fetch(apiOrigin+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});let d;try{d=await r.json()}catch{throw new Error(t(\"تعذّر الاتصال بالخدمة. اتأكد من الإنترنت وجرّب تاني.\"))}if(d.serverNow)d.receivedAt=performance.now();if(!r.ok)throw new Error(d.error||t(\"تعذّر تنفيذ الطلب.\"));return d}\nfunction setIdentity(v){identity=v;$('identityAnonymous').setAttribute('aria-pressed',String(v==='anonymous'));$('identityNamed').setAttribute('aria-pressed',String(v==='named'));$('identityHint').textContent=v==='named'?t(\"كل مشارك هيكتب اسمه، وهتشوف اسمه جنب إجابته. قول للقاعة قبل المشاركة.\"):t(\"هتشوف الردود من غير أسماء، زي الوضع الحالي.\")} $('identityAnonymous').onclick=()=>setIdentity('anonymous');$('identityNamed').onclick=()=>setIdentity('named');$('participantName').oninput=()=>{try{sessionStorage.setItem('hall.name',$('participantName').value)}catch{}renderParticipant()};\nfunction setOptionCount(n){if($('correctChoice')){$('correctChoice').options[3].hidden=n===2;if(Number($('correctChoice').value)>=n)$('correctChoice').value='';}optionCount=n;$('thirdOption').classList.toggle('hidden',mode==='text'||n===2);$('twoOptions').setAttribute('aria-pressed',String(n===2));$('threeOptions').setAttribute('aria-pressed',String(n===3));if(mode==='poll')$('modeHint').textContent=n===2?t(\"المتدرب يختار إجابة واحدة من خيارين.\"):t(\"المتدرب يختار إجابة واحدة من ٣ اختيارات.\")} $('twoOptions').onclick=()=>setOptionCount(2);$('threeOptions').onclick=()=>setOptionCount(3);\nfunction setMode(v){if(pendingRanking)v='ranking';mode=v;$('modeRanking').setAttribute('aria-pressed',String(v==='ranking'));$('rankingSetup').classList.toggle('hidden',v!=='ranking');$('modePoll').setAttribute('aria-pressed',String(v==='poll'));$('modeText').setAttribute('aria-pressed',String(v==='text'));for(const el of document.querySelectorAll('.option-field'))el.classList.toggle('hidden',v==='text');$('modeHint').textContent=v==='text'?t(\"المتدرب يكتب رد واحد لحد ٥٠٠ حرف. ظهور الاسم حسب وضع الهوية اللي اخترته فوق.\"):t(\"المتدرب يختار إجابة واحدة من ٣ اختيارات.\");$('optionCount').classList.toggle('hidden',v==='text');setOptionCount(optionCount);if(v==='ranking')$('modeHint').textContent=t('رانكينج · أسرع إجابة')} $('modeRanking').onclick=()=>setMode('ranking');$('modePoll').onclick=()=>setMode('poll');$('modeText').onclick=()=>setMode('text');$('writtenAnswer').oninput=()=>{$('charCount').textContent=$('writtenAnswer').value.length;$('vote').disabled=!$('writtenAnswer').value.trim()||(current?.identity==='named'&&!$('participantName').value.trim())||!current?.open||current?.voted||sending};\nconst bank=[{\"id\": 1, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه أكلة تقدر تاكلها كل يوم من غير زهق؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What food could you eat every day without getting bored?\", \"options\": []}}, {\"id\": 2, \"category\": \"كسرة جليد سريعة\", \"question\": \"آخر صورة على موبايلك، إيه حكايتها؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What is the story behind the last photo on your phone?\", \"options\": []}}, {\"id\": 3, \"category\": \"كسرة جليد سريعة\", \"question\": \"شاي ولا قهوة؟ ومحدش يزعل\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"Tea or coffee? No hard feelings!\", \"options\": []}}, {\"id\": 4, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه أول حاجة بتعملها أول ما تصحى؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What is the first thing you do when you wake up?\", \"options\": []}}, {\"id\": 5, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه اسم فيلم ممكن تتفرج عليه ١٠ مرات؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What film could you watch ten times?\", \"options\": []}}, {\"id\": 6, \"category\": \"كسرة جليد سريعة\", \"question\": \"آخر أغنية سمعتها وعجبتك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What was the last song you heard and liked?\", \"options\": []}}, {\"id\": 7, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه أغرب حاجة في شنطتك دلوقتي؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What is the strangest thing in your bag right now?\", \"options\": []}}, {\"id\": 8, \"category\": \"كسرة جليد سريعة\", \"question\": \"لو يومك ٢٥ ساعة، الساعة الزيادة تعمل فيها إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"If your day had 25 hours, what would you do with the extra hour?\", \"options\": []}}, {\"id\": 9, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه اسم أول موبايل كان عندك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What was your first mobile phone?\", \"options\": []}}, {\"id\": 10, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه أطرف كلمة مصرية بتحب تقولها؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What Egyptian expression do you find funniest?\", \"options\": []}}, {\"id\": 11, \"category\": \"لو كنت...\", \"question\": \"لو كنت شخصية كرتون، تكون مين؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you were a cartoon character, who would you be?\", \"options\": []}}, {\"id\": 12, \"category\": \"لو كنت...\", \"question\": \"لو تقدر تسافر أي حتة بكرة، تروح فين؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could travel anywhere tomorrow, where would you go?\", \"options\": []}}, {\"id\": 13, \"category\": \"لو كنت...\", \"question\": \"لو عندك قوة خارقة واحدة، تختار إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could have one superpower, what would it be?\", \"options\": []}}, {\"id\": 14, \"category\": \"لو كنت...\", \"question\": \"لو حياتك فيلم، مين يمثل دورك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If your life were a film, who would play you?\", \"options\": []}}, {\"id\": 15, \"category\": \"لو كنت...\", \"question\": \"لو تقدر تقابل أي حد في العالم، مين؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could meet anyone in the world, who would it be?\", \"options\": []}}, {\"id\": 16, \"category\": \"لو كنت...\", \"question\": \"لو تشتغل أي شغلانة تانية خالص، تكون إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could do any completely different job, what would it be?\", \"options\": []}}, {\"id\": 17, \"category\": \"لو كنت...\", \"question\": \"لو فلوسك مش هتخلص أبداً، أول حاجة تشتريها؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If your money could never run out, what would you buy first?\", \"options\": []}}, {\"id\": 18, \"category\": \"لو كنت...\", \"question\": \"لو ترجع بالزمن ١٠ سنين، هتقول لنفسك إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could go back ten years, what would you tell yourself?\", \"options\": []}}, {\"id\": 19, \"category\": \"لو كنت...\", \"question\": \"لو تعيش في أي عصر تاني، تختار أنهي؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could live in another era, which would you choose?\", \"options\": []}}, {\"id\": 20, \"category\": \"لو كنت...\", \"question\": \"لو اسمك براند، هيبقى براند إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If your name were a brand, what kind of brand would it be?\", \"options\": []}}, {\"id\": 21, \"category\": \"ده ولا ده\", \"question\": \"بحر ولا جبل؟\", \"mode\": \"poll\", \"options\": [\"بحر\", \"جبل\"], \"en\": {\"category\": \"This or that\", \"question\": \"Beach or mountains?\", \"options\": [\"Beach\", \"Mountains\"]}}, {\"id\": 22, \"category\": \"ده ولا ده\", \"question\": \"صيف ولا شتا؟\", \"mode\": \"poll\", \"options\": [\"صيف\", \"شتا\"], \"en\": {\"category\": \"This or that\", \"question\": \"Summer or winter?\", \"options\": [\"Summer\", \"Winter\"]}}, {\"id\": 23, \"category\": \"ده ولا ده\", \"question\": \"كشري ولا فول وطعمية؟\", \"mode\": \"poll\", \"options\": [\"كشري\", \"فول وطعمية\"], \"en\": {\"category\": \"This or that\", \"question\": \"Koshari or ful medames and falafel?\", \"options\": [\"Koshari\", \"Ful medames and falafel\"]}}, {\"id\": 24, \"category\": \"ده ولا ده\", \"question\": \"قطط ولا كلاب؟\", \"mode\": \"poll\", \"options\": [\"قطط\", \"كلاب\"], \"en\": {\"category\": \"This or that\", \"question\": \"Cats or dogs?\", \"options\": [\"Cats\", \"Dogs\"]}}, {\"id\": 25, \"category\": \"ده ولا ده\", \"question\": \"تسهر ولا تصحى بدري؟\", \"mode\": \"poll\", \"options\": [\"تسهر\", \"تصحى بدري\"], \"en\": {\"category\": \"This or that\", \"question\": \"Stay up late or wake up early?\", \"options\": [\"Stay up late\", \"Wake up early\"]}}, {\"id\": 26, \"category\": \"ده ولا ده\", \"question\": \"فطار ولا عشا؟\", \"mode\": \"poll\", \"options\": [\"فطار\", \"عشا\"], \"en\": {\"category\": \"This or that\", \"question\": \"Breakfast or dinner?\", \"options\": [\"Breakfast\", \"Dinner\"]}}, {\"id\": 27, \"category\": \"ده ولا ده\", \"question\": \"نتفليكس ولا سينما؟\", \"mode\": \"poll\", \"options\": [\"نتفليكس\", \"سينما\"], \"en\": {\"category\": \"This or that\", \"question\": \"Netflix or cinema?\", \"options\": [\"Netflix\", \"Cinema\"]}}, {\"id\": 28, \"category\": \"ده ولا ده\", \"question\": \"مدينة ولا قرية؟\", \"mode\": \"poll\", \"options\": [\"مدينة\", \"قرية\"], \"en\": {\"category\": \"This or that\", \"question\": \"City or village?\", \"options\": [\"City\", \"Village\"]}}, {\"id\": 29, \"category\": \"ده ولا ده\", \"question\": \"حلو ولا حادق؟\", \"mode\": \"poll\", \"options\": [\"حلو\", \"حادق\"], \"en\": {\"category\": \"This or that\", \"question\": \"Sweet or savoury?\", \"options\": [\"Sweet\", \"Savoury\"]}}, {\"id\": 30, \"category\": \"ده ولا ده\", \"question\": \"موبايل ولا لابتوب؟\", \"mode\": \"poll\", \"options\": [\"موبايل\", \"لابتوب\"], \"en\": {\"category\": \"This or that\", \"question\": \"Phone or laptop?\", \"options\": [\"Phone\", \"Laptop\"]}}, {\"id\": 31, \"category\": \"ضحك\", \"question\": \"إيه أغرب حاجة عملتها وانت صغير؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the strangest thing you did as a child?\", \"options\": []}}, {\"id\": 32, \"category\": \"ضحك\", \"question\": \"إيه أكتر كذبة صدقتها وانت طفل؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the biggest lie you believed as a child?\", \"options\": []}}, {\"id\": 33, \"category\": \"ضحك\", \"question\": \"إيه أسوأ هدية وصلتك في حياتك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the worst gift you have ever received?\", \"options\": []}}, {\"id\": 34, \"category\": \"ضحك\", \"question\": \"إيه موقف محرج لسه فاكره لحد دلوقتي؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What embarrassing moment do you still remember?\", \"options\": []}}, {\"id\": 35, \"category\": \"ضحك\", \"question\": \"لو في مسابقة أكل، تكسب في أنهي أكلة؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What food would you win an eating contest with?\", \"options\": []}}, {\"id\": 36, \"category\": \"ضحك\", \"question\": \"إيه أطرف اسم دلع اتناديت بيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the funniest nickname you have ever had?\", \"options\": []}}, {\"id\": 37, \"category\": \"ضحك\", \"question\": \"لو حياتك مسلسل، هيبقى كوميدي ولا دراما؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"If your life were a TV series, would it be a comedy or a drama?\", \"options\": []}}, {\"id\": 38, \"category\": \"ضحك\", \"question\": \"إيه أكتر حاجة بتضحكك مهما كان مودك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What always makes you laugh, whatever your mood?\", \"options\": []}}, {\"id\": 39, \"category\": \"ضحك\", \"question\": \"إيه موقف \\\"أنا مش مصدق إني عملت كده\\\" وفخور بيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is something you cannot believe you did, but feel proud of?\", \"options\": []}}, {\"id\": 40, \"category\": \"ضحك\", \"question\": \"إيه أغرب مكان نمت فيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the strangest place you have slept?\", \"options\": []}}, {\"id\": 41, \"category\": \"موودك\", \"question\": \"إيه الحاجة اللي بتشحن طاقتك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What recharges your energy?\", \"options\": []}}, {\"id\": 42, \"category\": \"موودك\", \"question\": \"اكتب حاجة واحدة بتحبها في نفسك\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"Write one thing you like about yourself.\", \"options\": []}}, {\"id\": 43, \"category\": \"موودك\", \"question\": \"إيه أحلى حاجة حصلتلك الأسبوع ده؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What is the nicest thing that happened to you this week?\", \"options\": []}}, {\"id\": 44, \"category\": \"موودك\", \"question\": \"لو مودك النهاردة طقس، يبقى إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"If your mood today were weather, what would it be?\", \"options\": []}}, {\"id\": 45, \"category\": \"موودك\", \"question\": \"إيه أكلة نفسك فيها دلوقتي حالاً؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What food are you craving right now?\", \"options\": []}}, {\"id\": 46, \"category\": \"موودك\", \"question\": \"إيه الشغلانة اللي مستحيل تعملها أبداً؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What job would you never do?\", \"options\": []}}, {\"id\": 47, \"category\": \"موودك\", \"question\": \"اكتب إنجاز صغير فخور بيه الفترة دي\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"Write a small achievement you feel proud of lately.\", \"options\": []}}, {\"id\": 48, \"category\": \"موودك\", \"question\": \"لو هتحتفل بأي حاجة النهاردة، هتحتفل بإيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"If you were celebrating something today, what would it be?\", \"options\": []}}, {\"id\": 49, \"category\": \"موودك\", \"question\": \"إيه نصيحة سمعتها وغيّرت فيك حاجة؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What piece of advice has changed you?\", \"options\": []}}, {\"id\": 50, \"category\": \"موودك\", \"question\": \"كلمة واحدة توصف مودك دلوقتي\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"Describe your mood right now in one word.\", \"options\": []}}];\nlet bankCategory=bank[0].category;\nfunction renderBank(){const cats=[...new Set(bank.map(x=>x.category))];$('bankTabs').innerHTML=cats.map(c=>'<button class=\"secondary\" data-category=\"'+esc(c)+'\" aria-pressed=\"'+(c===bankCategory)+'\">'+esc(lang==='en'?bank.find(x=>x.category===c).en.category:c)+'</button>').join('');$('bankCategory').textContent=(lang==='en'?bank.find(x=>x.category===bankCategory).en.category:bankCategory)+t(\" · ١٠ أسئلة\");$('bankList').innerHTML=bank.filter(x=>x.category===bankCategory).map(x=>'<button class=\"bank-pick\" data-bank=\"'+x.id+'\"><b>'+x.id+'</b><span>'+esc(localBank(x).question)+'</span><small>'+(x.mode==='poll'?t(\"خيارين\"):t(\"مكتوبة\"))+'</small></button>').join('');for(const el of document.querySelectorAll('[data-category]'))el.onclick=()=>{bankCategory=el.dataset.category;renderBank()};for(const el of document.querySelectorAll('[data-bank]'))el.onclick=()=>{const x=localBank(bank.find(q=>q.id===Number(el.dataset.bank)));$('title').value=x.category;$('question').value=x.question;setMode(x.mode);setOptionCount(x.mode==='poll'?x.options.length:3);for(let i=0;i<3;i++)$('option'+i).value=x.options[i]||'';$('bankSelected').dataset.questionId=x.id;$('bankSelected').textContent=t(\"اتختار السؤال \")+x.id+t(\". راجع الحقول وعدّل قبل ما تبدأ.\");$('bankPanel').open=false;$('question').focus()}}\n$('openBank').onclick=()=>{show('setup');$('bankPanel').open=true;$('bankPanel').scrollIntoView({behavior:'smooth',block:'start'})};renderBank();\n$('startTrainer').onclick=()=>show('setup');$('resume').onclick=()=>startTrainer(saved());\n$('create').onclick=async()=>{const b=$('create');b.disabled=true;try{const durationSeconds=readDuration();const payload={durationSeconds,mode,identity,title:$('title').value.trim(),question:$('question').value.trim(),options:Array.from({length:optionCount},(_,i)=>i).map(i=>$('option'+i).value.trim())};if(!payload.title||!payload.question||(mode!=='text'&&payload.options.some(x=>!x)))throw new Error(t(\"كمّل عنوان السيشن والسؤال وكل الاختيارات.\"));if(mode==='ranking'){payload.hasCorrect=rankingCorrect;if(rankingCorrect){if($('correctChoice').value==='')throw new Error(t('اختار الإجابة الصحيحة من الاختيارات.'));payload.correctChoice=Number($('correctChoice').value);}if(pendingRanking)payload.rankingRound=pendingRanking;}const d=await api('/sessions',payload);pendingRanking=null;$('continuingRanking').classList.add('hidden');save(d);await startTrainer(d)}catch(e){error(e)}finally{b.disabled=false}};\nasync function startTrainer(info){if(!info)return;current=info;show('trainer');const u=location.origin+joinPath+'?code='+info.code+'&lang='+lang;$('sessionCode').textContent=info.code;for(const id of ['joinUrl','openJoin','qrLink'])$(id).href=u;$('joinUrl').textContent=u;$('qr').src=apiOrigin+'/qr?code='+info.code+'&lang='+lang+(pagesHost?'&frontend=pages':'');await refreshTrainer();timer=setInterval(()=>{if(!document.hidden)refreshTrainer()},5000)}\nasync function refreshTrainer(){try{const d=await api('/sessions/'+current.code+'/results',null,current.token);current={...current,...d};renderRanking(d);$('trainerTitle').textContent=d.title;$('resultQuestion').textContent=d.question;$('total').textContent=d.total;$('empty').classList.toggle('hidden',d.total>0);$('toggle').disabled=!!d.timeUp||!!d.roundEnded;$('pollStatus').textContent=d.timeUp?t('الوقت خلص. استقبال الردود اتقفل تلقائياً.'):d.open?(d.mode==='text'?t(\"استقبال الردود مفتوح\"):t(\"التصويت مفتوح\")):(d.mode==='text'?t(\"استقبال الردود مقفول\"):t(\"التصويت مقفول\"));$('toggle').textContent=d.roundEnded?t('الجولة انتهت. ابدأ جولة جديدة.'):d.timeUp?t('الوقت خلص'):d.open?(d.mode==='text'?t(\"اقفل الردود\"):t(\"اقفل التصويت\")):(d.mode==='text'?t(\"افتح الردود\"):t(\"افتح التصويت\"));$('results').innerHTML=d.mode==='text'?d.answers.map((a,i)=>'<article class=\"written-answer\"><small dir=\"auto\">'+esc(d.identity==='named'?a.name||t(\"مشارك\"):t(\"رد \")+(d.total-i))+'</small><div dir=\"auto\">'+esc(a.answer)+'</div></article>').join(''):d.options.map((o,i)=>{const n=d.counts[i],p=d.total?Math.round(n/d.total*100):0;return '<div><div class=\"result-head\"><span>'+esc(o)+'</span><strong dir=\"ltr\">'+n+' · '+p+'%</strong></div><div class=\"track\"><div class=\"bar\" style=\"width:'+p+'%\"></div></div></div>'}).join('');$('namedPollSection').classList.toggle('hidden',d.identity!=='named'||d.mode==='text'||d.mode==='ranking');$('namedPollAnswers').innerHTML=(d.respondents||[]).map(a=>'<article class=\"written-answer\"><small dir=\"auto\">'+esc(a.name)+'</small><div>'+esc(d.options[a.choice])+'</div></article>').join('');$('connection').innerHTML='<span class=\"dot\"></span>'+t(\"متصل · آخر تحديث \")+new Date().toLocaleTimeString(lang==='en'?'en-GB':'ar-EG',{hour:'2-digit',minute:'2-digit',second:'2-digit'});$('globalError').textContent='';updateCountdown()}catch(e){$('connection').textContent=t(\"التحديث متوقف مؤقتاً، بنحاول تاني\");error(e)}}\n$('toggle').onclick=async()=>{const b=$('toggle');b.disabled=true;try{await api('/sessions/'+current.code+'/status',{open:!current.open},current.token);await refreshTrainer()}catch(e){error(e)}finally{b.disabled=false}};\n$('copyJoin').onclick=async()=>{try{await navigator.clipboard.writeText($('joinUrl').href);$('copyJoin').textContent=t(\"اتنسخ الرابط\")}catch{$('copyJoin').textContent=t(\"انسخ الرابط المكتوب تحت الزر\")}};\n$('newSession').onclick=()=>{pendingRanking=null;$('continuingRanking').classList.add('hidden');$('newConfirm').classList.remove('hidden')};$('cancelNew').onclick=()=>$('newConfirm').classList.add('hidden');$('confirmNew').onclick=async()=>{try{await api('/sessions/'+current.code+(current.mode==='ranking'?'/finish':'/status'),current.mode==='ranking'?{}:{open:false},current.token);$('newConfirm').classList.add('hidden');show('setup')}catch(e){error(e)}};\n$('joinButton').onclick=join;$('joinCode').addEventListener('keydown',e=>{if(e.key==='Enter')join()});\nasync function join(){const code=$('joinCode').value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));if(!/^\\d{6}$/.test(code)){error(new Error(t(\"اكتب كود السيشن المكوّن من ٦ أرقام.\")));return}$('joinButton').disabled=true;try{current=await api('/sessions/'+code+'?client='+encodeURIComponent(client()));selected=-1;try{$('participantName').value=sessionStorage.getItem('hall.name')||''}catch{}$('writtenAnswer').value='';$('charCount').textContent='0';show('participant');renderParticipant();timer=setInterval(()=>{if(!document.hidden)refreshParticipant()},5000)}catch(e){error(e)}finally{$('joinButton').disabled=false}}\nfunction renderParticipant(){if(timerRemaining()===0)current.open=false;const text=current.mode==='text',named=current.identity==='named',missingName=named&&!$('participantName').value.trim();$('nameEntry').classList.toggle('hidden',!named||current.voted);$('participantName').disabled=current.voted||sending;$('textPrivacy').textContent=named?t(\"ردك واسمك بيوصلوا للمدرب فقط.\"):t(\"ردك من غير اسم، وبيوصل للمدرب فقط.\");$('rankingParticipantInfo').classList.toggle('hidden',current.mode!=='ranking');$('rankingParticipantRule').textContent=t(current.hasCorrect?'رانكينج · أسرع إجابة صحيحة':'رانكينج · أسرع إجابة');for(const el of $('participant').querySelectorAll('[data-normal-only]'))el.classList.toggle('hidden',current.mode==='ranking');$('answerType').textContent=current.mode==='ranking'?t(current.hasCorrect?'رانكينج · أسرع إجابة صحيحة':'رانكينج · أسرع إجابة'):text?t(\"سؤال مفتوح · إجابة مكتوبة\"):t(\"تصويت سريع · اختيار واحد\");$('choices').classList.toggle('hidden',text);$('textEntry').classList.toggle('hidden',!text);$('writtenAnswer').disabled=!current.open||current.voted||sending;$('participantTitle').textContent=current.title;$('participantQuestion').textContent=current.question;$('choices').innerHTML=current.options.map((o,i)=>'<button class=\"choice '+(selected===i?'selected':'')+'\" data-choice=\"'+i+'\" aria-pressed=\"'+(selected===i)+'\" '+((!current.open||current.voted||sending)?'disabled':'')+'><span class=\"number\">'+(i+1)+'</span><span class=\"answer\" dir=\"auto\">'+esc(o)+'</span><span aria-hidden=\"true\">'+(selected===i?'✓':'○')+'</span></button>').join('');for(const el of document.querySelectorAll('[data-choice]'))el.onclick=()=>{selected=Number(el.dataset.choice);renderParticipant()};$('vote').textContent=text?t(\"ابعث إجابتي\"):t(\"ثبّت إجابتي\");$('vote').disabled=(text?!$('writtenAnswer').value.trim():selected<0)||missingName||!current.open||current.voted||sending;$('vote').classList.toggle('hidden',current.voted);$('voteStatus').classList.toggle('hidden',!current.voted&&current.open);$('voteStatus').textContent=current.timeUp&&!current.voted?t('الوقت خلص. استقبال الردود اتقفل تلقائياً.'):current.voted?t(\"اتسجّل ردك ووصل للمدرب. شكراً لمشاركتك.\"):t(\"المدرب قفل استقبال الردود. لو فتحه تاني هتقدر تشارك.\");updateCountdown();$('participantConnection').textContent=current.timeUp?t('الوقت خلص. استقبال الردود اتقفل تلقائياً.'):current.open?t(\"متصل · استقبال الردود مفتوح\"):t(\"متصل · استقبال الردود مقفول\")}\nasync function refreshParticipant(){try{current=await api('/sessions/'+current.code+'?client='+encodeURIComponent(client()));renderParticipant();$('globalError').textContent=''}catch(e){$('participantConnection').textContent=t(\"تعذّر تحديث حالة السيشن\");$('vote').disabled=true;error(e)}}\n$('vote').onclick=async()=>{if((current.mode==='text'?!$('writtenAnswer').value.trim():selected<0)||(current.identity==='named'&&!$('participantName').value.trim())||sending)return;sending=true;renderParticipant();try{await api('/sessions/'+current.code+'/vote',{client:client(),name:current.identity==='named'?$('participantName').value:undefined,choice:selected,answer:current.mode==='text'?$('writtenAnswer').value.trim():undefined});await refreshParticipant()}catch(e){error(e);await refreshParticipant()}finally{sending=false;renderParticipant()}};\nwindow.addEventListener('online',()=>{if(role==='trainer'){renderRanking(current);refreshTrainer()};if(role==='participant')refreshParticipant()});\n\nlet timerEnabled=false,expiredCountdownKey='';\nfunction setTimer(v){timerEnabled=v;$('timerOff').setAttribute('aria-pressed',String(!v));$('timerOn').setAttribute('aria-pressed',String(v));$('timerDuration').classList.toggle('hidden',!v)}\nfunction readDuration(){if(!timerEnabled)return 0;const m=$('timerMinutes').value.trim(),s=$('timerSeconds').value.trim();if(!/^\\d+$/.test(m)||!/^\\d+$/.test(s)||Number(m)>1439||Number(s)>59||Number(m)*60+Number(s)<1)throw new Error(t('اكتب الدقائق من ٠ لحد ١٤٣٩ والثواني من ٠ لحد ٥٩. المدة لازم تكون ثانية على الأقل.'));return Number(m)*60+Number(s)}\nfunction timerRemaining(){if(!current?.endsAt)return null;return Math.max(0,Math.ceil((current.endsAt-(current.serverNow+(performance.now()-(current.receivedAt??performance.now()))))/1000))}\nfunction updateCountdown(){const left=timerRemaining();for(const [id,view] of [['trainerCountdown','trainer'],['participantCountdown','participant']]){const el=$(id),visible=role===view&&left!==null;el.classList.toggle('hidden',!visible);if(!visible)continue;el.querySelector('.countdown-label').textContent=t(left===0?'الوقت خلص':'الوقت المتبقي');el.querySelector('.countdown-value').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');el.classList.toggle('urgent',left>0&&left<=10);el.classList.toggle('expired',left===0);const note=el.querySelector('.countdown-note');note.classList.toggle('hidden',left!==0);note.textContent=t('الوقت خلص. استقبال الردود اتقفل تلقائياً.')}if(left===0&&current){current.open=false;current.timeUp=true;const key=current.code+':'+current.endsAt;if(expiredCountdownKey!==key){expiredCountdownKey=key;if(role==='participant')queueMicrotask(()=>{renderParticipant();refreshParticipant()});if(role==='trainer'){ $('toggle').disabled=true;$('toggle').textContent=t('الوقت خلص');$('pollStatus').textContent=t('الوقت خلص. استقبال الردود اتقفل تلقائياً.');queueMicrotask(refreshTrainer)}}}}\n$('timerOff').onclick=()=>setTimer(false);$('timerOn').onclick=()=>setTimer(true);setInterval(updateCountdown,200);\n\nlet theme='light';try{theme=localStorage.getItem('roompulse.theme')||'light'}catch{}if(!['light','dark'].includes(theme))theme='light';\nfunction applyTheme(){document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme==='dark'?'dark':'light';const b=document.getElementById('themeToggle');if(b){b.setAttribute('aria-pressed',String(theme==='dark'));b.setAttribute('aria-label',t('تغيير المظهر'));document.getElementById('themeLabel').textContent=t(theme==='dark'?'الوضع الفاتح':'الوضع الداكن')}}\nfunction toggleTheme(){theme=theme==='dark'?'light':'dark';try{localStorage.setItem('roompulse.theme',theme)}catch{}applyTheme()}\n$('themeToggle').onclick=()=>{toggleTheme();drawWheel()};applyTheme();\n\nlet rankingCorrect=false,pendingRanking=null;\nfunction setRankingCorrect(v){rankingCorrect=v;$('rankingHasCorrect').setAttribute('aria-pressed',String(v));$('rankingNoCorrect').setAttribute('aria-pressed',String(!v));$('correctChoiceBox').classList.toggle('hidden',!v)}\n$('rankingHasCorrect').onclick=()=>setRankingCorrect(true);$('rankingNoCorrect').onclick=()=>setRankingCorrect(false);\n$('separateRanking').onclick=()=>{pendingRanking=null;$('continuingRanking').classList.add('hidden')};\nfunction rankingRows(rows,round=false){return rows.map(a=>'<article class=\"ranking-row\"><div class=\"ranking-place\">'+a.rank+'</div><div><strong dir=\"auto\">'+esc(a.name||t('مشارك ')+a.participant)+'</strong><small>'+esc(round?a.correctAnswers+' '+t('إجابات مؤهلة'):(a.elapsedMs/1000).toFixed(3)+' '+t('ثانية'))+'</small></div><div class=\"ranking-points\">'+a.points+'<small>'+t('نقطة')+'</small></div></article>').join('')}\nfunction renderRanking(d){if(!d)return;const is=d.mode==='ranking';$('rankingResults').classList.toggle('hidden',!is);$('results').classList.toggle('hidden',is);for(const el of $('trainer').querySelectorAll('[data-normal-only]'))el.classList.toggle('hidden',is);$('newSession').textContent=t(is?'جولة جديدة':'سيشن جديد');if(!is)return;$('rankingHint').textContent=d.roundEnded?t('الجولة خلصت. السكور النهائي ظاهر تحت.'):!d.rankingReady?t('اقفل الردود أو استنى المؤقت يخلص عشان يظهر ترتيب السؤال.'):(d.leaderboard?.length?'':t('مفيش إجابات مؤهلة للترتيب لسه.'));$('rankingList').innerHTML=rankingRows(d.leaderboard||[]);$('roundResults').classList.toggle('hidden',!d.roundEnded);$('roundList').innerHTML=rankingRows(d.roundLeaderboard||[],true);$('nextRanking').classList.toggle('hidden',!!d.roundEnded);$('finishRanking').classList.toggle('hidden',!!d.roundEnded);$('newSession').textContent=t('جولة جديدة');}\n$('nextRanking').onclick=async()=>{try{await api('/sessions/'+current.code+'/status',{open:false},current.token);pendingRanking={code:current.code,token:current.token};$('continuingRanking').classList.remove('hidden');$('question').value='';for(let i=0;i<3;i++)$('option'+i).value='';$('correctChoice').value='';$('bankSelected').textContent='';delete $('bankSelected').dataset.questionId;setMode('ranking');setIdentity(current.identity);show('setup')}catch(e){error(e)}};\n$('finishRanking').onclick=async()=>{if(!confirm(t('إنهاء الجولة يقفل كل أسئلتها نهائياً. متأكد؟')))return;const b=$('finishRanking');b.disabled=true;try{await api('/sessions/'+current.code+'/finish',{},current.token);await refreshTrainer()}catch(e){error(e)}finally{b.disabled=false}};\n\nlet wheelItems=[],wheelRotation=0,wheelSpinning=false,wheelWinner=null,wheelFrame=null;\nfunction wheelEntries(){return $('wheelEntries').value.split(/\\r?\\n/).map(s=>s.trim()).filter(Boolean)}\nfunction validateWheel(items){if(items.length<2)throw new Error(t('اكتب عنصرين على الأقل، كل عنصر في سطر.'));if(items.length>200)throw new Error(t('الحد الأقصى ٢٠٠ عنصر في اللفة.'));if(items.some(x=>x.length>100))throw new Error(t('كل عنصر لحد ١٠٠ حرف.'));}\nfunction wheelChanged(){if(wheelSpinning)return;wheelItems=wheelEntries();wheelWinner=null;$('wheelWinner').textContent='';$('wheelResult').classList.add('hidden');$('wheelCount').textContent=wheelItems.length+' '+t('عنصر');$('wheelSpin').disabled=wheelItems.length<2||wheelItems.length>200||wheelItems.some(x=>x.length>100);wheelRotation=0;drawWheel();}\nfunction wheelColor(i,n){const dark=theme==='dark';const colors=dark?['#E60000','#7F1D1D','#DA6B6B','#572C32','#9D3945','#BD5B40']:['#E60000','#FBE4E4','#EF8F8F','#8B1515','#F4B8AD','#BA4B4B'];return colors[i%colors.length]}\nfunction wheelRandomIndex(n){const bound=Math.floor(4294967296/n)*n;let x;do{x=crypto.getRandomValues(new Uint32Array(1))[0]}while(x>=bound);return x%n}\nfunction drawWheel(){const canvas=$('wheelCanvas');if(!canvas)return;const ctx=canvas.getContext('2d'),size=720,c=size/2,r=338;canvas.width=size;canvas.height=size;ctx.clearRect(0,0,size,size);const n=wheelItems.length,items=n?wheelItems:[t('أضف العناصر')],step=Math.PI*2/items.length;ctx.save();ctx.translate(c,c);ctx.rotate(wheelRotation-Math.PI/2);items.forEach((item,i)=>{const a=i*step;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,a,a+step);ctx.closePath();ctx.fillStyle=n?wheelColor(i,items.length):(theme==='dark'?'#292125':'#FBE4E4');ctx.fill();ctx.strokeStyle=theme==='dark'?'#111':'#fff';ctx.lineWidth=2;ctx.stroke();if(items.length<=40){ctx.save();ctx.rotate(a+step/2);ctx.translate(r*.64,0);ctx.rotate(Math.PI/2);ctx.fillStyle=n&&[0,3,5].includes(i%6)?'#fff':'#181818';if(theme==='dark')ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 '+(items.length>20?15:items.length>12?20:25)+'px Arial, sans-serif';let label=item;const width=items.length>12?95:160;while(ctx.measureText(label).width>width&&label.length>1)label=label.slice(0,-2);if(label!==item)label+='…';ctx.fillText(label,0,0);ctx.restore();}});ctx.restore();ctx.beginPath();ctx.arc(c,c,43,0,Math.PI*2);ctx.fillStyle=theme==='dark'?'#202126':'#fff';ctx.fill();ctx.lineWidth=6;ctx.strokeStyle='#E60000';ctx.stroke();ctx.fillStyle='#E60000';ctx.font='900 21px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('RP',c,c);ctx.beginPath();ctx.moveTo(c-20,7);ctx.lineTo(c+20,7);ctx.lineTo(c,52);ctx.closePath();ctx.fillStyle=theme==='dark'?'#fff':'#191919';ctx.fill();canvas.setAttribute('aria-label',t('عجلة اختيار عشوائي')+' · '+wheelItems.length+' '+t('عنصر'));}\nfunction openWheel(){show('wheel');wheelChanged()}\nfunction renderWheelLanguage(){if(!$('wheelCanvas'))return;$('wheelCount').textContent=wheelItems.length+' '+t('عنصر');$('wheelSpin').textContent=t(wheelSpinning?'بتلف…':'لف العجلة');if(wheelWinner!==null)$('wheelWinner').textContent=wheelItems[wheelWinner];drawWheel()}\nasync function spinWheel(){if(wheelSpinning)return;try{wheelItems=wheelEntries();validateWheel(wheelItems)}catch(e){error(e);return}wheelSpinning=true;wheelWinner=null;$('wheelEntries').disabled=true;$('wheelSpin').disabled=true;$('wheelClear').disabled=true;$('wheelResult').classList.add('hidden');$('wheelSpin').textContent=t('بتلف…');$('globalError').textContent='';const index=wheelRandomIndex(wheelItems.length),step=Math.PI*2/wheelItems.length,base=wheelRotation,normalized=((base%(Math.PI*2))+Math.PI*2)%(Math.PI*2),target=2*Math.PI-(index+.5)*step,delta=6*Math.PI+((target-normalized+2*Math.PI)%(2*Math.PI)),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduce?0:4200,start=performance.now();const finish=()=>{wheelRotation=base+delta;wheelWinner=index;wheelSpinning=false;$('wheelEntries').disabled=false;$('wheelSpin').disabled=false;$('wheelClear').disabled=false;$('wheelSpin').textContent=t('لف العجلة');$('wheelWinner').textContent=wheelItems[index];$('wheelResult').classList.remove('hidden');drawWheel()};if(!duration){finish();return}await new Promise(resolve=>{const frame=now=>{const p=Math.min(1,(now-start)/duration);wheelRotation=base+delta*(1-Math.pow(1-p,4));drawWheel();if(p<1)wheelFrame=requestAnimationFrame(frame);else{finish();resolve()}};wheelFrame=requestAnimationFrame(frame)});}\n$('wheelTab').onclick=openWheel;$('openWheel').onclick=openWheel;$('activitiesTab').onclick=()=>show('welcome');$('wheelEntries').oninput=wheelChanged;$('wheelSpin').onclick=spinWheel;$('wheelClear').onclick=()=>{if(wheelSpinning)return;if(!$('wheelEntries').value||confirm(t('تمسح كل عناصر العجلة؟'))){$('wheelEntries').value='';wheelChanged()}};\n\ndocument.querySelectorAll('a[href=\"/\"]').forEach(a=>a.href=appBase);document.querySelectorAll('a[href=\"/join\"]').forEach(a=>a.href=joinPath);\nif(location.pathname==='/join'||location.pathname===appBase+'join/'||location.pathname===appBase+'join/index.html'){show('join');const code=new URLSearchParams(location.search).get('code');if(code){$('joinCode').value=code;join()}}else{show('welcome');$('resumeBox').classList.toggle('hidden',!saved())}\n\n$('langAR').onclick=()=>setLanguage('ar');$('langEN').onclick=()=>setLanguage('en');applyLanguage();renderBank();setIdentity(identity);setMode(mode);\n</script></body></html>";
const schema = [
`CREATE TABLE IF NOT EXISTS ranking_rounds (code TEXT PRIMARY KEY, ended INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS ranking_sessions (code TEXT PRIMARY KEY, started INTEGER NOT NULL, correct INTEGER, group_code TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS ranking_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, client TEXT NOT NULL, choice INTEGER NOT NULL, received INTEGER NOT NULL, UNIQUE(code,client))`,
`CREATE INDEX IF NOT EXISTS ranking_answers_code ON ranking_answers(code,received,id)`,
`CREATE TABLE IF NOT EXISTS session_timers (code TEXT PRIMARY KEY, duration INTEGER NOT NULL, ends_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS sessions (code TEXT PRIMARY KEY, token TEXT NOT NULL, title TEXT NOT NULL, question TEXT NOT NULL, options TEXT NOT NULL, open INTEGER NOT NULL DEFAULT 1, expires INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS votes (code TEXT NOT NULL, client TEXT NOT NULL, choice INTEGER NOT NULL, PRIMARY KEY(code,client))`,
`CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires)`,
`CREATE TABLE IF NOT EXISTS session_modes (code TEXT PRIMARY KEY, mode TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS text_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, client TEXT NOT NULL, answer TEXT NOT NULL, created INTEGER NOT NULL, UNIQUE(code,client))`,
`CREATE INDEX IF NOT EXISTS answers_code ON text_answers(code,id)`,
`CREATE TABLE IF NOT EXISTS session_identity (code TEXT PRIMARY KEY, identity TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS participant_names (code TEXT NOT NULL, client TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(code,client))`
];
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
async function hash(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function body(req){const t=await req.text();if(t.length>8192)fail('حجم الطلب أكبر من المسموح.');try{return JSON.parse(t)}catch{fail('بيانات الطلب غير صحيحة.')}}
function clean(s,n){if(typeof s!=='string'||!s.trim()||s.trim().length>n)fail('كمّل السؤال والاختيارات، والتزم بالطول المسموح.');return s.trim()}

async function roundScores(db,groupCode,identity){
const rows=await db.prepare('SELECT a.id,a.client,a.choice,a.received,r.code,r.started,r.correct,n.name FROM ranking_answers a JOIN ranking_sessions r ON r.code=a.code LEFT JOIN participant_names n ON n.code=a.code AND n.client=a.client WHERE r.group_code=? ORDER BY a.id').bind(groupCode).all();
const players=new Map();for(const a of rows.results){if(!players.has(a.client))players.set(a.client,{participant:players.size+1,...(identity==='named'?{name:a.name||''}:{}),points:0,correctAnswers:0,answers:0});players.get(a.client).answers++;}
const codes=[...new Set(rows.results.map(a=>a.code))];for(const code of codes){const eligible=rows.results.filter(a=>a.code===code&&(a.correct===null||a.choice===a.correct)).sort((a,b)=>a.received-b.received||a.id-b.id);let previous=null,rank=0;eligible.forEach((a,i)=>{if(a.received!==previous)rank=i+1;previous=a.received;const p=players.get(a.client);p.points+=Math.max(1,Math.floor(1000/rank));p.correctAnswers++;});}
const list=[...players.values()].sort((a,b)=>b.points-a.points||a.participant-b.participant);let previous=null,rank=0;return list.map((p,i)=>{if(p.points!==previous)rank=i+1;previous=p.points;return {...p,rank}});
}

const app = {
async fetch(req,env){try{
const u=new URL(req.url),path=u.pathname,now=Date.now();
if(path==='/qr'&&req.method==='GET'){const code=u.searchParams.get('code');if(!/^\d{6}$/.test(code||''))return json({error:'كود غير صحيح.'},400);const qr=qrcode(0,'M');qr.addData((u.searchParams.get('frontend')==='pages'?'https://omarnagycd.github.io/RoomPulse/join/':u.origin+'/join')+'?code='+code+'&lang='+(u.searchParams.get('lang')==='en'?'en':'ar'));qr.make();return new Response(qr.createSvgTag({cellSize:5,margin:20,scalable:true}),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public,max-age=300'}})}
if(!path.startsWith('/api/')){if(path!=='/'&&path!=='/join')return new Response('Not found',{status:404});return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"}})}
if(!env.DB)fail('الخدمة قيد التجهيز. جرّب بعد قليل.',503);
if(req.method==='POST'&&path==='/api/sessions'){
const b=await body(req),title=clean(b.title,80),question=clean(b.question,300),mode=['text','ranking'].includes(b.mode)?b.mode:'poll',identity=b.identity==='named'?'named':'anonymous';
if(mode!=='text'&&(!Array.isArray(b.options)||![2,3].includes(b.options.length)))fail('مطلوب خيارين أو ٣ اختيارات.');const options=mode==='text'?[]:b.options.map(x=>clean(x,200));
let groupCode=null;if(mode==='ranking'&&b.rankingRound){const prior=b.rankingRound;if(typeof prior.code!=='string'||typeof prior.token!=='string'||prior.token.length>200)fail('جولة غير صحيحة.',403);const owner=await env.DB.prepare('SELECT s.token,r.group_code,g.ended,i.identity FROM sessions s JOIN ranking_sessions r ON r.code=s.code JOIN ranking_rounds g ON g.code=r.group_code JOIN session_identity i ON i.code=s.code WHERE s.code=? AND s.expires>?').bind(prior.code,now).first();if(!owner||owner.token!==await hash(prior.token))fail('الجولة دي مش متاحة من المتصفح الحالي.',403);if(owner.ended)fail('الجولة انتهت. ابدأ جولة جديدة.',409);if(owner.identity!==identity)fail('خلي وضع الأسماء ثابت في نفس الجولة.');groupCode=owner.group_code;const size=await env.DB.prepare('SELECT count(*) as n FROM ranking_sessions WHERE group_code=?').bind(groupCode).first();if(size.n>=50)fail('الجولة وصلت ٥٠ سؤال. ابدأ جولة جديدة.',409);}
const correct=mode==='ranking'&&b.hasCorrect===true?b.correctChoice:null;if(correct!==null&&(!Number.isInteger(correct)||correct<0||correct>=options.length))fail('اختار الإجابة الصحيحة من الاختيارات.');
const duration=b.durationSeconds??0;if(!Number.isInteger(duration)||duration<0||duration>86399)fail('اختار مدة صحيحة من ثانية لحد ٢٣ ساعة و٥٩ دقيقة و٥٩ ثانية، أو اقفل المؤقت.');
await env.DB.batch(schema.map(s=>env.DB.prepare(s)));
await env.DB.batch([env.DB.prepare('DELETE FROM ranking_rounds WHERE code NOT IN (SELECT group_code FROM ranking_sessions WHERE code IN (SELECT code FROM sessions WHERE expires >= ?))').bind(now),env.DB.prepare('DELETE FROM ranking_answers WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM ranking_sessions WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM session_timers WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM participant_names WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM session_identity WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM text_answers WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM session_modes WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM votes WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now)]);
const count=await env.DB.prepare('SELECT count(*) as n FROM sessions').first();if(count.n>=1000)fail('وصلنا للحد التجريبي اليومي. جرّب لاحقاً.',429);
if(groupCode)await env.DB.prepare('UPDATE sessions SET open=0 WHERE code IN (SELECT code FROM ranking_sessions WHERE group_code=?)').bind(groupCode).run();
const token=crypto.randomUUID()+crypto.randomUUID(),tokenHash=await hash(token);let code,ok=false;
for(let i=0;i<5;i++){code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);const r=await env.DB.prepare('INSERT OR IGNORE INTO sessions(code,token,title,question,options,expires) VALUES(?,?,?,?,?,?)').bind(code,tokenHash,title,question,JSON.stringify(options),now+86400000).run();if(r.meta.changes){ok=true;break}}
if(!ok)fail('تعذّر إنشاء كود جديد. جرّب تاني.',503);await env.DB.prepare('INSERT INTO session_modes(code,mode) VALUES(?,?)').bind(code,mode).run();await env.DB.prepare('INSERT INTO session_identity(code,identity) VALUES(?,?)').bind(code,identity).run();if(mode==='ranking'){groupCode=groupCode||code;await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO ranking_rounds(code) VALUES(?)').bind(groupCode),env.DB.prepare('INSERT INTO ranking_sessions(code,started,correct,group_code) VALUES(?,?,?,?)').bind(code,now,correct,groupCode)]);}if(duration)await env.DB.prepare('INSERT INTO session_timers(code,duration,ends_at) VALUES(?,?,?)').bind(code,duration,Date.now()+duration*1000).run();return json({code,token},201)}
const m=path.match(/^\/api\/sessions\/(\d{6})(?:\/(results|vote|status|finish))?$/);if(!m)fail('الرابط مش موجود.',404);const code=m[1],action=m[2];
let s;try{s=await env.DB.prepare('SELECT * FROM sessions WHERE code=? AND expires>?').bind(code,now).first()}catch{fail('مفيش سيشن بالكود ده. اتأكد من الكود.',404)}
if(!s)fail('الكود غير صحيح أو السيشن انتهى. اتأكد من المدرب.',404);
const row=await env.DB.prepare('SELECT mode FROM session_modes WHERE code=?').bind(code).first();const mode=row?.mode||'poll';const ident=await env.DB.prepare('SELECT identity FROM session_identity WHERE code=?').bind(code).first();const identity=ident?.identity||'anonymous';let clock=null;try{clock=await env.DB.prepare('SELECT duration,ends_at FROM session_timers WHERE code=?').bind(code).first()}catch(e){if(!String(e.message).includes('no such table'))throw e}const timeUp=!!clock&&now>=clock.ends_at;if(timeUp)s.open=0;const options=JSON.parse(s.options),base={code,mode,identity,title:s.title,question:s.question,options,open:!!s.open,expires:s.expires,durationSeconds:clock?.duration||0,endsAt:clock?.ends_at||null,serverNow:now,timeUp};
const ranking=mode==='ranking'?await env.DB.prepare('SELECT r.started,r.correct,r.group_code,g.ended FROM ranking_sessions r JOIN ranking_rounds g ON g.code=r.group_code WHERE r.code=?').bind(code).first():null;if(ranking){base.hasCorrect=ranking.correct!==null;if(ranking.ended){s.open=0;base.open=false;}base.roundEnded=!!ranking.ended;}
if(!action&&req.method==='GET'){const c=u.searchParams.get('client')||'';let voted=false;if(c&&c.length<100){const v=await env.DB.prepare(mode==='ranking'?'SELECT 1 FROM ranking_answers WHERE code=? AND client=?':mode==='text'?'SELECT 1 FROM text_answers WHERE code=? AND client=?':'SELECT 1 FROM votes WHERE code=? AND client=?').bind(code,await hash(c)).first();voted=!!v}return json({...base,voted})}
if(action==='vote'&&req.method==='POST'){
if(timeUp)fail('الوقت خلص. استقبال الردود اتقفل تلقائياً.',409);const b=await body(req);if(identity==='named'){if(typeof b.client!=='string'||!b.client||b.client.length>100)fail('بيانات المتصفح غير صحيحة.');if(typeof b.name!=='string'||!b.name.trim()||b.name.length>200)fail('اكتب الاسم اللي تحب تظهر بيه، لحد ٢٠٠ حرف.');const name=b.name;if(!s.open)fail('المدرب قفل استقبال الردود.',409);await env.DB.prepare('INSERT OR IGNORE INTO participant_names(code,client,name) VALUES(?,?,?)').bind(code,await hash(b.client),name).run()}if(mode==='text'){if(typeof b.client!=='string'||!b.client||b.client.length>100)fail('بيانات المتصفح غير صحيحة.');const answer=clean(b.answer,500),c=await hash(b.client);const existing=await env.DB.prepare('SELECT 1 FROM text_answers WHERE code=? AND client=?').bind(code,c).first();if(existing)return json({ok:true,duplicate:true});if(!s.open)fail('المدرب قفل الردود.',409);const r=await env.DB.prepare('INSERT OR IGNORE INTO text_answers(code,client,answer,created) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE code=? AND open=1 AND expires>?) AND NOT EXISTS (SELECT 1 FROM session_timers WHERE code=? AND ends_at<=CAST((julianday(\'now\')-2440587.5)*86400000 AS INTEGER)) AND (SELECT count(*) FROM text_answers WHERE code=?)<5000').bind(code,c,answer,now,code,now,code,code).run();if(!r.meta.changes)fail('استقبال الردود مقفول أو وصل للحد التجريبي.',409);return json({ok:true},201)}if(typeof b.client!=='string'||!b.client||b.client.length>100||!Number.isInteger(b.choice)||b.choice<0||b.choice>=options.length)fail('اختار إجابة صحيحة.');
if(mode==='ranking'){
const c=await hash(b.client);const existing=await env.DB.prepare('SELECT 1 FROM ranking_answers WHERE code=? AND client=?').bind(code,c).first();if(existing)return json({ok:true,duplicate:true});if(!s.open)fail('المدرب قفل استقبال الردود.',409);
const r=await env.DB.prepare("INSERT OR IGNORE INTO ranking_answers(code,client,choice,received) SELECT ?,?,?,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) WHERE EXISTS (SELECT 1 FROM sessions WHERE code=? AND open=1 AND expires>?) AND NOT EXISTS (SELECT 1 FROM session_timers WHERE code=? AND ends_at<=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AND (SELECT count(*) FROM ranking_answers WHERE code=?)<5000").bind(code,c,b.choice,code,now,code,code).run();if(!r.meta.changes)fail('استقبال الردود مقفول أو وصل للحد التجريبي.',409);return json({ok:true},201)}
const c=await hash(b.client);const existing=await env.DB.prepare('SELECT 1 FROM votes WHERE code=? AND client=?').bind(code,c).first();if(existing)return json({ok:true,duplicate:true});if(!s.open)fail('المدرب قفل التصويت.',409);
const r=await env.DB.prepare('INSERT OR IGNORE INTO votes(code,client,choice) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE code=? AND open=1 AND expires>?) AND NOT EXISTS (SELECT 1 FROM session_timers WHERE code=? AND ends_at<=CAST((julianday(\'now\')-2440587.5)*86400000 AS INTEGER)) AND (SELECT count(*) FROM votes WHERE code=?) < 5000').bind(code,c,b.choice,code,now,code,code).run();if(!r.meta.changes)fail('التصويت مقفول أو وصل للحد التجريبي.',409);return json({ok:true},201)}
if(action==='results'||action==='status'||action==='finish'){
const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer ')||await hash(auth.slice(7))!==s.token)fail('شاشة المدرب دي مش متاحة من المتصفح الحالي.',403);
if(action==='finish'&&req.method==='POST'&&ranking){await env.DB.batch([env.DB.prepare('UPDATE ranking_rounds SET ended=1 WHERE code=?').bind(ranking.group_code),env.DB.prepare('UPDATE sessions SET open=0 WHERE code IN (SELECT code FROM ranking_sessions WHERE group_code=?)').bind(ranking.group_code)]);return json({ok:true})}
if(action==='status'&&req.method==='POST'){const b=await body(req);if(typeof b.open!=='boolean')fail('حالة التصويت غير صحيحة.');if(b.open&&ranking?.ended)fail('الجولة انتهت. ابدأ جولة جديدة.',409);if(b.open&&timeUp)fail('الوقت خلص. ابدأ سيشن جديد لو عايز تكمل.',409);await env.DB.prepare('UPDATE sessions SET open=? WHERE code=?').bind(b.open?1:0,code).run();return json({ok:true})}
if(action==='results'&&req.method==='GET'){if(mode==='ranking'){
const all=await env.DB.prepare('SELECT a.id,a.client,a.choice,a.received,n.name FROM ranking_answers a LEFT JOIN participant_names n ON n.code=a.code AND n.client=a.client WHERE a.code=? ORDER BY a.received,a.id').bind(code).all();
const ids=await env.DB.prepare('SELECT a.client,MIN(a.id) AS first_id FROM ranking_answers a JOIN ranking_sessions r ON r.code=a.code WHERE r.group_code=? GROUP BY a.client ORDER BY first_id').bind(ranking.group_code).all();const counts=options.map((_,i)=>all.results.filter(a=>a.choice===i).length);const eligible=all.results.filter(a=>ranking.correct===null||a.choice===ranking.correct);let previous=null,rank=0;
const leaderboard=s.open?[]:eligible.map((a,i)=>{const elapsed=Math.max(0,a.received-ranking.started);if(elapsed!==previous)rank=i+1;previous=elapsed;return {rank,participant:ids.results.findIndex(x=>x.client===a.client)+1,...(identity==='named'?{name:a.name||''}:{}),choice:a.choice,elapsedMs:elapsed,points:Math.max(1,Math.floor(1000/rank))}});
const roundLeaderboard=ranking.ended?await roundScores(env.DB,ranking.group_code,identity):[];return json({...base,roundLeaderboard,counts,total:all.results.length,rankingReady:!s.open,correctChoice:ranking.correct,eligibleTotal:s.open?null:eligible.length,leaderboard})}
if(mode==='text'){const a=await env.DB.prepare(identity==='named'?'SELECT a.id,a.answer,a.created,n.name FROM text_answers a LEFT JOIN participant_names n ON n.code=a.code AND n.client=a.client WHERE a.code=? ORDER BY a.id DESC':'SELECT id,answer,created FROM text_answers WHERE code=? ORDER BY id DESC').bind(code).all();return json({...base,answers:a.results,total:a.results.length})}const r=await env.DB.prepare('SELECT choice,count(*) as n FROM votes WHERE code=? GROUP BY choice').bind(code).all();const counts=options.map((_,i)=>r.results.find(x=>x.choice===i)?.n||0);let respondents=[];if(identity==='named'){const n=await env.DB.prepare('SELECT n.name,v.choice FROM votes v JOIN participant_names n ON n.code=v.code AND n.client=v.client WHERE v.code=? ORDER BY v.rowid DESC').bind(code).all();respondents=n.results}return json({...base,counts,total:counts.reduce((a,b)=>a+b,0),...(identity==='named'?{respondents}:{})})}}
return json({error:'الطلب غير مسموح.'},405);
}catch(e){return json({error:e.status?e.message:'تعذّر الاتصال بالخدمة. جرّب تاني بعد قليل.'},e.status||503)}}
};


// CORS is browser read permission, not authentication. Existing trainer-token checks remain required.
const PAGES_ORIGIN = 'https://omarnagycd.github.io';
export default {
 async fetch(req,env,ctx) {
  const url=new URL(req.url),origin=req.headers.get('Origin');
  const apiRoute=url.pathname.startsWith('/api/');
  const allowed=origin===PAGES_ORIGIN;
  if(apiRoute && req.method==='OPTIONS'){
   if(!allowed)return new Response(null,{status:403,headers:{'Vary':'Origin'}});
   const method=req.headers.get('Access-Control-Request-Method');
   const headers=(req.headers.get('Access-Control-Request-Headers')||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
   if(!['GET','POST'].includes(method)||headers.some(h=>!['authorization','content-type'].includes(h)))return new Response(null,{status:403,headers:{'Vary':'Origin'}});
   return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':PAGES_ORIGIN,'Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Vary':'Origin'}});
  }
  const response=await app.fetch(req,env,ctx);
  if(!apiRoute||!allowed)return response;
  const out=new Response(response.body,response);out.headers.set('Access-Control-Allow-Origin',PAGES_ORIGIN);out.headers.set('Vary','Origin');return out;
 }
};
