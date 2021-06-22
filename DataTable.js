import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { makeStyles, withStyles } from '@material-ui/core/styles/';
import Swal from 'sweetalert2';
import { Icon } from '@material-ui/core';
import { debounce } from 'lodash'
import { BayerApiService } from '../../services/Bayer/BayerApiService';
import HeaderButton from '../../pages/admin/components/headerButton';
import RefreshButton from '../../pages/admin/components/RefreshButton';
import Loading from '../../pages/home/components/Loading';
import EditorConvertToHTML from '../../pages/admin/components/EditorConvertToHTML';
import { useSelector } from 'react-redux';
import translate from '../../../_metronic/i18n/translate/lib/index';
import {
  Portlet,
  PortletBody,
  PortletHeader,
  PortletHeaderToolbar
} from "../../partials/content/Portlet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableFooter,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
  colors
} from '@material-ui/core';

const BrownRadio = withStyles({
  root: {
    color: colors.brown[400],
    '&$checked': {
      color: colors.brown[600],
    },
  },
  checked: {},
})((props) => <Radio color="default" {...props} />);

const EnhancedTableHead = (props) => {
  const { headRows } = props;

  return (
    <TableHead>
      <TableRow>
        {(headRows || []).map((row, i) => (
          <TableCell
            key={row.column || i}
            align={row.align ? row.align : 'left'}
            padding={row.disablePadding ? 'none' : 'default'}
            size={row.size || null}
            width={row.width || undefined}
          >
            {row.label}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

EnhancedTableHead.propTypes = {
  onRequestSort: PropTypes.func.isRequired,
  order: PropTypes.string.isRequired,
  orderBy: PropTypes.string.isRequired,
  rowCount: PropTypes.number.isRequired,
  headRows: PropTypes.array.isRequired
};

const api = new BayerApiService();

function Datatable(props) {
  const locale = useSelector(({ i18n }) => i18n.lang);
  const { widthTable } = props;
  const useStyles = makeStyles(theme => {
    return ({
      root: {
        width: '100%',
        marginTop: theme.spacing(0),
      },
      paper: {
        width: '100%',
        marginBottom: theme.spacing(0),
      },
      table: {
        minWidth: widthTable ? widthTable : 400,
      },
      tableWrapper: {
        overflowX: 'auto',
      },
      search: {
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
      },
      radio: {
        flexWrap: 'nowrap',
        padding: '1rem',
      }
    })
  });

  const classes = useStyles();
  const currentState = loadPaginationState();

  let rows = props.rows;
  const [order, setOrder] = React.useState(currentState.order || 'desc');
  const [orderBy, setOrderBy] = React.useState(
    currentState.orderBy
    || props.orderBy
    || props.headRows[0].column
    || 'id'
  );
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(currentState.perPage || 10);
  const [count, setCount] = React.useState(rows.length);
  const [inputSearch, setInputSearch] = React.useState(props.search || '');
  const [isLoading, setIsLoading] = React.useState('');
  const [isLoadingExport, setIsLoadingExport] = React.useState('');
  const [reload, setReload] = React.useState(props.reload || false);
  const [isActive, setIsActive] = React.useState(props.isActive || "true");
  const pageCurrentState = currentState.page

  const onSearch = useRef(
    debounce((e, searchLoad) => {
      if (e.length >= 3 || e.length === 0) {
        searchLoad(e)
      }
    }, 500)
  ).current;

  function search(e) {
    setInputSearch(e.target.value)
    onSearch(e.target.value, (e) => searchLoad(e))
  }

  function searchLoad(e) {
    loadRecords({
      page: 0,
      search: e,
      isActive
    });
  }

  function onRadioChange(e) {
    setIsActive(e.target.value);

    loadRecords({
      page: pageCurrentState || page,
      search: inputSearch,
      isActive: e.target.value
    })
  }

  async function exportRecords(config = {}) {
    setIsLoadingExport(true);

    let params = {
      page: (config.page !== undefined ? config.page : page) + 1,
      perPage: config.perPage || rowsPerPage,
      orderBy: config.orderBy || orderBy,
      orderByDirection: config.orderByDirection || order,
      filterString: config.search,
      isActive
    };

    await api.download(
      {
        url: (config.isEndpointFull ? (config.endpoint || '') : props.endpoint + (config.endpoint || '')),
        params,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    setIsLoadingExport(false);
  }

  async function loadRecords(config = {}) {
    setIsLoading(true)
    let params = {
      page: (config.page !== undefined ? config.page : page) + 1,
      perPage: config.perPage || rowsPerPage,
      orderBy: config.orderBy || orderBy,
      orderByDirection: config.orderByDirection || order,
      filterString: config.search,
      isActive: config.isActive === undefined
        ? false
        : config.isActive
    };

    try {
      const response = await api.makeHttpRequest({
        url: props.endpoint,
        method: 'POST',
        data: params
      });

      const body = response.body || response;

      if (props.setCountAndFilter) {
        props.setCountAndFilter(body.total, {
          ...params,
          page: 1,
          perPage: body.total
        });
      }

      const totalPages = Math.ceil(body.total / params.perPage);

      setCount(body.total);
      props.setRows(body.data);
      setPage(params.page < totalPages ?
        params.page - 1 > 0 ? params.page - 1 : 0 :
        totalPages - 1 > 0 ? totalPages - 1 : 0);
      savePaginationState(params);

      if (inputSearch !== config.search) {
        setInputSearch(config.search);
      }
    } catch (e) {
      Swal.fire(
        translate(locale).defaultMessages.error,
        translate(locale).defaultMessages.loadData,
        'error'
      );
    } finally {
      setIsLoading(false);
      setReload(false);
    }
  }

  useEffect(() => {
    setIsActive("true");
    loadRecords({
      page: props.skipPaginationState === false ? (pageCurrentState || page) : page,
      search: props.search || inputSearch,
      isActive: "true"
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.reload]);

  function loadPaginationState() {
    const paginationState = JSON.parse(localStorage.getItem('pagination') || '{}');
    if (paginationState[props.endpoint]) {
      return paginationState[props.endpoint];
    }

    return {};
  }

  function savePaginationState(state) {
    const paginationState = JSON.parse(localStorage.getItem('pagination') || '{}');
    state.page--;
    paginationState[props.endpoint] = state;

    localStorage.setItem('pagination', JSON.stringify(paginationState));
  }

  function handleRequestSort(property) {
    const isDesc = orderBy === property && order === 'desc';
    const direction = isDesc ? 'asc' : 'desc';
    setOrder(direction);
    setOrderBy(property);
    loadRecords({
      orderByDirection:
      direction, orderBy:
      property,
      search: inputSearch,
      isActive
    });
  }

  function handleChangePage(newPage) {
    setPage(newPage);
    loadRecords({
      page: newPage,
      search: inputSearch,
      isActive
    });
  }

  function handleChangeRowsPerPage(event) {
    setPage(0);
    setRowsPerPage(+event.target.value);
    loadRecords({
      perPage: event.target.value,
      page: 0, search: inputSearch,
      isActive
    });
  }

  function refreshAction() {
    loadRecords({
      page: pageCurrentState || page,
      search: inputSearch,
      isActive
    })
  }

  const Mobile = props.mobile;

  if (reload) {
    refreshAction();
  }

  const generateMobileButtons = () => {
    return (
      <>
        <li className="kt-nav__item">
          <a href={void (0)} className="kt-nav__link" onClick={refreshAction}>
            <i className='kt-nav__link-icon flaticon2-reload'></i>
            <span className="kt-nav__link-text">
              {translate(locale).datatable.refresh}
            </span>
          </a>
        </li>
        {props.buttons.length > 0
          ? (props.buttons.map((btn, i) => {
            const btnOnClick = btn.endpoint ? () => exportRecords({
              orderByDirection: order,
              orderBy: orderBy,
              search: inputSearch,
              endpoint: btn.endpoint,
              isEndpointFull: btn.isEndpointFull
            }) : btn.onClick;

            return (
              btn.path
                ? (
                  <Link to={btn.path} className="kt-nav__item" key={i}>
                    <span className="kt-nav__link" onClick={btnOnClick}>
                      <i className={`kt-nav__link-icon flaticon-${btn.icone}`}></i>
                      <span className="kt-nav__link-text">{btn.label}</span>
                    </span>
                  </Link>
                )
                : (
                  <li className="kt-nav__item" key={i}>
                    <a href={void (0)} className="kt-nav__link" onClick={btnOnClick}>
                      <i className={`kt-nav__link-icon flaticon-${btn.icone}`}></i>
                      <span className="kt-nav__link-text">{btn.label}</span>
                    </a>
                  </li>
                )
            )

          }))
          : null}
      </>
    )
  }

  return (
    <div className={`col-xl-12 ${props.className}`} style={{ marginTop: "10px" }}>
      <Loading isLoading={isLoading || isLoadingExport} />
      <Portlet fluidHeight={true}>
        <PortletHeader
          title={props.title}
          toolbar={
            (props.width >= 768 || !props.mobile)
              ? (
                <PortletHeaderToolbar>
                  {props.buttons && props.buttons.length > 0 ?
                    props.buttons.map((item, index) => (
                      <HeaderButton
                        key={index}
                        path={item.path}
                        label={item.label}
                        onClick={item.endpoint ? () => exportRecords({
                          orderByDirection: order,
                          orderBy: orderBy,
                          search: inputSearch,
                          endpoint: item.endpoint,
                          isEndpointFull: item.isEndpointFull
                        }) : item.onClick}
                        icone={item.icone}
                        disabled={item.disabled} />
                    ))
                    :
                    null
                  }
                  <RefreshButton refreshAction={refreshAction} />
                </PortletHeaderToolbar>
              )
              : <Mobile actions={props.actions || null} width={props.width} buttons={generateMobileButtons} refreshAction={() => refreshAction} />
          }
        />

        <PortletBody fit={true}>
          <div className={classes.root}>

            {props.placeholderSearch ?
              <div className={classes.search}>
                {!props.disableStatus &&
                <RadioGroup className={classes.radio} row aria-label="filtro" name="filtroStatus" value={isActive} onChange={onRadioChange}>
                  <FormControlLabel value="true" control={<BrownRadio />}  label={translate(locale).datatable.active} />
                  <FormControlLabel value="false" control={<BrownRadio />} label={translate(locale).datatable.inactive} />
                </RadioGroup>
                }
                <div className="kt-input-icon kt-input-icon--left p-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder={props.placeholderSearch}
                    onChange={search}
                    value={inputSearch}
                  />
                  <span className="kt-input-icon__icon kt-input-icon__icon--left pl-4 ">
                    <Icon>search</Icon>
                  </span>
                </div>
              </div>
              :
              null
            }

            {props.editorEmail ?
              <EditorConvertToHTML resetEditor={props.resetEditor} getEmail={(html, assunto) => props.setEmail(html, assunto)} />
              :
              null
            }

            <Paper className={classes.paper}>
              <div className={classes.tableWrapper}>
                <Table className={classes.table}>
                  <EnhancedTableHead
                    order={order}
                    orderBy={orderBy}
                    onRequestSort={handleRequestSort}
                    rowCount={rows.length}
                    headRows={props.headRows}
                  />
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={props.headRows.length} className='text-center'>
                          {translate(locale).defaultMessages.loading}
                        </TableCell>
                      </TableRow>
                    ) : (
                        count > 0 ?
                          rows.map((row) => props.formatRow(row)) :
                          <TableRow>
                            <TableCell colSpan={props.headRows.length} className='text-center'>
                              {translate(locale).datatable.nothingData}
                        </TableCell>
                          </TableRow>
                      )}
                  </TableBody>

                </Table>
                <Table>
                  <TableFooter>
                    <TableRow>
                      <TablePagination
                        rowsPerPageOptions={[10, 20, 50]}
                        labelDisplayedRows={({from, to, count}) => `${from}-${to} ${translate(locale).datatable.of} ${count}`}
                        colSpan={10}
                        count={count || 0}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        labelRowsPerPage={translate(locale).datatable.labelRowsPerPage}
                        backIconButtonProps={{
                          'aria-label': translate(locale).datatable.backButton,
                        }}
                        nextIconButtonProps={{
                          'aria-label': translate(locale).datatable.nextButton,
                        }}
                        onChangePage={handleChangePage}
                        onChangeRowsPerPage={handleChangeRowsPerPage}
                      />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </Paper>
          </div>
        </PortletBody>
      </Portlet>
    </div>
  );
}

export default Datatable;